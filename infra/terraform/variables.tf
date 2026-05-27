variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "project_name" {
  type    = string
  default = "innotech-honeypot"
}

variable "domain_name" {
  type        = string
  description = "Public hostname for the ALB (optional for initial bring-up)"
  default     = ""
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS listener (must cover domain_name)"
  default     = ""
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "trusted_proxy_cidrs" {
  type    = list(string)
  default = ["10.0.0.0/8"]
}

variable "safezone_db_uri_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for SAFEZONE_DB_URI"
  default     = ""
}

variable "malicious_db_uri_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for MALICIOUS_DB_URI"
  default     = ""
}

variable "jwt_secret_arn" {
  type    = string
  default = ""
}

variable "socket_token_secret_arn" {
  type    = string
  default = ""
}
