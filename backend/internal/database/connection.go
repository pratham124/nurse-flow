package database

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const DevelopmentProject = "nmitctyxtjmlakcsmnuj"

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// Store owns one reusable connection pool. Close it when the process finishes.
type Store struct {
	db   *gorm.DB
	pool *sql.DB
}

// DevelopmentURL reads server-only settings and restricts the connection to development.
func DevelopmentURL() (string, error) {
	host := os.Getenv("NURSEFLOW_DB_HOST")
	password := os.Getenv("NURSEFLOW_DB_PASSWORD")
	if host == "" || password == "" {
		return "", errors.New("set NURSEFLOW_DB_HOST and NURSEFLOW_DB_PASSWORD")
	}

	user := "nurseflow_go"
	if host != "db."+DevelopmentProject+".supabase.co" {
		if !regexp.MustCompile(`^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$`).MatchString(host) {
			return "", errors.New("database host must be the development direct host or a Supabase session pooler")
		}
		user += "." + DevelopmentProject
	}

	connection := &url.URL{
		Scheme: "postgresql",
		Host:   host + ":5432",
		User:   url.UserPassword(user, password),
		Path:   "/postgres",
	}
	query := url.Values{
		"sslmode":         {"verify-full"},
		"connect_timeout": {"5"},
	}
	if certificate := os.Getenv("NURSEFLOW_DB_SSLROOTCERT"); certificate != "" {
		query.Set("sslrootcert", certificate)
	}
	connection.RawQuery = query.Encode()
	return connection.String(), nil
}

func OpenDevelopment(ctx context.Context) (*Store, error) {
	connectionURL, err := DevelopmentURL()
	if err != nil {
		return nil, err
	}
	return open(ctx, connectionURL)
}

func open(ctx context.Context, connectionURL string) (*Store, error) {
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  connectionURL,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		DisableAutomaticPing: true,
		Logger:               logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, errors.New("could not initialize database connection")
	}
	pool, err := db.DB()
	if err != nil {
		return nil, errors.New("could not initialize database pool")
	}
	pool.SetMaxOpenConns(5)
	pool.SetMaxIdleConns(2)
	pool.SetConnMaxLifetime(30 * time.Minute)
	pool.SetConnMaxIdleTime(5 * time.Minute)

	store := &Store{db: db, pool: pool}
	if err := store.Check(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Check(ctx context.Context) error {
	checkContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := s.pool.PingContext(checkContext); err != nil {
		return errors.New("database connection failed; check development settings and availability")
	}

	var role struct {
		Name      string `gorm:"column:name"`
		Superuser bool   `gorm:"column:superuser"`
		BypassRLS bool   `gorm:"column:bypass_rls"`
	}
	if err := s.db.WithContext(checkContext).Raw(`
		SELECT rolname AS name, rolsuper AS superuser, rolbypassrls AS bypass_rls
		FROM pg_roles WHERE rolname = current_user
	`).Scan(&role).Error; err != nil {
		return errors.New("could not check database role")
	}
	if role.Name != "nurseflow_go" || role.Superuser || role.BypassRLS {
		return errors.New("database must use the limited nurseflow_go role")
	}
	return nil
}

func (s *Store) Close() error {
	return s.pool.Close()
}

// WithIdentity must receive an Auth user ID from server-verified identity, never client input.
// The setting is transaction-local so it cannot leak to another pooled request.
func (s *Store) WithIdentity(ctx context.Context, authUserID string, query func(*gorm.DB) error) error {
	if !uuidPattern.MatchString(authUserID) {
		return errors.New("database identity must be an Auth user UUID")
	}
	queryContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return s.db.WithContext(queryContext).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT set_config('nurseflow.auth_user_id', ?, true)", strings.ToLower(authUserID)).Error; err != nil {
			return errors.New("could not set database request identity")
		}
		if err := tx.Exec("SELECT set_config('statement_timeout', '5000', true)").Error; err != nil {
			return errors.New("could not set database query timeout")
		}
		return query(tx)
	}, &sql.TxOptions{ReadOnly: true})
}
