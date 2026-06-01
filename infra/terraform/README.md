# Terraform (AWS Production)

> **Owner:** Sagiv Levy

Infrastructure-as-code for deploying the stack to AWS.

| File | Purpose |
|------|---------|
| `main.tf`, `variables.tf`, `versions.tf` | Root AWS stack |
| `terraform.tfvars.example` | Example variable values |
| [`modules/`](modules/) | Reusable building blocks (vpc, alb, ecs, ecr) |

```bash
cd infra/terraform
terraform init
terraform plan
```

See the deploy section of the root [`README.md`](../../README.md) for the full workflow.
