# Build the NurseFlow Go API into a small, non-root container image.
# Build from the repository root with:
#   docker build -t nurseflow-api backend

# Stage 1: compile with the same Go version as go.mod.
FROM golang:1.27.1-bookworm AS build
WORKDIR /src

# Download modules first so this layer is reused when only source files change.
COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal
# CGO off produces a static binary that needs no C libraries at runtime.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# Stage 2: distroless has no shell or package manager, only CA certificates
# (needed for HTTPS to Supabase Auth and the solver) and a nonroot user.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
# Public Supabase Root 2021 CA, so Postgres TLS keeps sslmode=verify-full.
COPY certs/supabase-root-2021-ca.crt /etc/nurseflow/supabase-root-2021-ca.crt

ENV NURSEFLOW_HTTP_ADDR=:8080 \
    NURSEFLOW_DB_SSLROOTCERT=/etc/nurseflow/supabase-root-2021-ca.crt
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/api"]
