#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_file="${repo_root}/infra/.env"
secret_env="${INFISICAL_ENV:-dev}"
secret_path="${INFISICAL_PATH:-/}"

if ! command -v infisical >/dev/null 2>&1; then
  echo "Infisical CLI is not installed. See README.md#shared-secrets-with-infisical."
  exit 1
fi

if [[ ! -f "${repo_root}/.infisical.json" && -z "${INFISICAL_PROJECT_ID:-}" ]]; then
  echo "This checkout is not linked to Infisical. Run 'infisical init' in the repository root,"
  echo "or set INFISICAL_PROJECT_ID to the EVATION project ID."
  exit 1
fi

temp_file="$(mktemp "${TMPDIR:-/tmp}/evation-env.XXXXXX")"
trap 'rm -f "${temp_file}"' EXIT

cd "${repo_root}"
export_args=(export --format=dotenv --env="${secret_env}" --path="${secret_path}")
if [[ -n "${INFISICAL_PROJECT_ID:-}" ]]; then
  export_args+=(--projectId="${INFISICAL_PROJECT_ID}")
fi

infisical "${export_args[@]}" > "${temp_file}"

required_keys=(
  SAFEZONE_DB_URI
  MALICIOUS_DB_URI
  JWT_SECRET
  GATEWAY_JWT_SECRET
  ADMIN_TOTP_ENC_KEY_BASE64
  ADMIN_SOCKET_TOKEN
  NEXT_PUBLIC_ADMIN_SOCKET_TOKEN
)

for key in "${required_keys[@]}"; do
  if ! grep -Eq "^${key}=.+" "${temp_file}"; then
    echo "Downloaded configuration is missing required secret: ${key}"
    exit 1
  fi
done

chmod 600 "${temp_file}"
mv "${temp_file}" "${target_file}"
trap - EXIT

echo "Updated infra/.env from Infisical (${secret_env}:${secret_path})."
