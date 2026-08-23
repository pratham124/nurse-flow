"""Supabase bearer-token verification for the HTTP boundary."""

from __future__ import annotations

from typing import Any

from .service import OptimizerAuthenticationError


class SupabaseJwtVerifier:
    """Verify a Supabase JWT against the configured published JWKS endpoint."""

    def __init__(
        self,
        *,
        jwks_url: str,
        issuer: str,
        audience: str,
        algorithms: tuple[str, ...] = ("RS256", "ES256"),
    ) -> None:
        self.jwks_url = jwks_url
        self.issuer = issuer
        self.audience = audience
        self.algorithms = algorithms
        self._jwks_client: Any | None = None

    def verify(self, authorization_header: str | None) -> str:
        if not authorization_header:
            raise OptimizerAuthenticationError("A bearer token is required.")

        scheme, _, token = authorization_header.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise OptimizerAuthenticationError("Use a bearer access token.")

        try:
            import jwt
            from jwt import PyJWKClient
        except ImportError as error:  # pragma: no cover - deployment configuration
            raise OptimizerAuthenticationError(
                "JWT verification is not configured on this service."
            ) from error

        try:
            if self._jwks_client is None:
                self._jwks_client = PyJWKClient(
                    self.jwks_url,
                    cache_jwk_set=True,
                    lifespan=300,
                    cache_keys=True,
                    timeout=5,
                )
            signing_key = self._jwks_client.get_signing_key_from_jwt(token.strip())
            claims = jwt.decode(
                token.strip(),
                signing_key.key,
                algorithms=list(self.algorithms),
                audience=self.audience,
                issuer=self.issuer,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except Exception as error:
            raise OptimizerAuthenticationError(
                "The bearer token is invalid or expired."
            ) from error

        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject.strip():
            raise OptimizerAuthenticationError(
                "The bearer token has no valid subject."
            )
        return subject
