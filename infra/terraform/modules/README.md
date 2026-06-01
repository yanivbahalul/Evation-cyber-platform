# Terraform Modules

> **Owner:** Sagiv Levy

Reusable building blocks composed by the root Terraform stack.

| Module | Provisions |
|--------|------------|
| [`vpc/`](vpc/) | Network — VPC, subnets, routing |
| [`alb/`](alb/) | Application Load Balancer — public entry + TLS |
| [`ecs/`](ecs/) | Container cluster + services |
| [`ecr/`](ecr/) | Container image registry |
