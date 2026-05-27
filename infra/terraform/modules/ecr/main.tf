variable "project_name" { type = string }

locals {
  repos = ["admin-panel", "gateway", "telemetry", "nginx"]
}

resource "aws_ecr_repository" "repos" {
  for_each             = toset(local.repos)
  name                 = "${var.project_name}/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
}

output "repository_urls" {
  value = { for k, r in aws_ecr_repository.repos : k => r.repository_url }
}
