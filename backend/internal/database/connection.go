// Package database maps existing tables and runs identity-scoped database operations.
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

// DevelopmentProject identifies the isolated Supabase project used by this backend.
const DevelopmentProject = "nmitctyxtjmlakcsmnuj"

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

// OpenDevelopment opens and verifies a connection using development-only settings.
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
		// Select the struct's own columns instead of *. The Go role is granted
		// specific columns, and a struct that leaves a column out (InviteRow has
		// no token_hash) then never reads it.
		QueryFields: true,
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

// Check verifies connectivity and requires the limited database role.
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
	// Raw: a catalog diagnostic, not an application table query.
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

// Close releases the store's database connection pool.
func (s *Store) Close() error {
	return s.pool.Close()
}

// WithIdentity requires an Auth UUID already validated by the caller (the JWT
// verifier for HTTP requests), never an unchecked client-supplied identity.
// The setting is transaction-local so it cannot leak to another pooled request.
func (s *Store) WithIdentity(ctx context.Context, authUserID string, query func(*gorm.DB) error) error {
	return s.withIdentity(ctx, authUserID, identityOptions{readOnly: true}, query)
}

// WithWriteIdentity gives a write the same bounded, transaction-local identity.
// It requires the same validated Auth UUID as WithIdentity.
// Returning an error from write rolls back every statement in the callback.
func (s *Store) WithWriteIdentity(ctx context.Context, authUserID string, write func(*gorm.DB) error) error {
	return s.withIdentity(ctx, authUserID, identityOptions{}, write)
}

// WithInviteCodeRead is WithIdentity plus the hash of the invite code the caller
// presented. The capability policies let that hash unlock only its own invite
// rows (ADR 0003). The hash comes from invites.HashCode, never from the client.
func (s *Store) WithInviteCodeRead(ctx context.Context, authUserID, tokenHash string, query func(*gorm.DB) error) error {
	return s.withIdentity(ctx, authUserID, identityOptions{readOnly: true, inviteTokenHash: tokenHash}, query)
}

// WithInviteCodeWrite is WithWriteIdentity plus the presented invite code hash.
func (s *Store) WithInviteCodeWrite(ctx context.Context, authUserID, tokenHash string, write func(*gorm.DB) error) error {
	return s.withIdentity(ctx, authUserID, identityOptions{inviteTokenHash: tokenHash}, write)
}

// identityOptions describes one identity transaction.
type identityOptions struct {
	readOnly        bool
	inviteTokenHash string // set only for invite-code requests
}

func (s *Store) withIdentity(ctx context.Context, authUserID string, options identityOptions, query func(*gorm.DB) error) error {
	queryContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return s.db.WithContext(queryContext).Transaction(func(tx *gorm.DB) error {
		// Raw: set_config is a function call; the third argument makes it transaction-local.
		if err := tx.Exec("SELECT set_config('nurseflow.auth_user_id', ?, true)", strings.ToLower(authUserID)).Error; err != nil {
			return errors.New("could not set database request identity")
		}
		if options.inviteTokenHash != "" {
			if err := tx.Exec("SELECT set_config('nurseflow.invite_token_hash', ?, true)", options.inviteTokenHash).Error; err != nil {
				return errors.New("could not set database invite capability")
			}
		}
		if err := tx.Exec("SELECT set_config('statement_timeout', '5000', true)").Error; err != nil {
			return errors.New("could not set database query timeout")
		}
		return query(tx)
	}, identityTransactionOptions(options.readOnly))
}

func identityTransactionOptions(readOnly bool) *sql.TxOptions {
	options := &sql.TxOptions{ReadOnly: readOnly}
	if readOnly {
		options.Isolation = sql.LevelRepeatableRead
	}
	return options
}
