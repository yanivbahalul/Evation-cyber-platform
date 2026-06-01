TERRAFORM (AWS production)
Owner: Sagiv Levy

  main.tf, variables.tf, versions.tf — Root AWS stack
  terraform.tfvars.example — Example variables
  modules/
    vpc/   Network
    alb/   Load balancer
    ecs/   Container service
    ecr/   Container registry

Deploy guide: docs/DEPLOYMENT.md (if present) or README.md deploy section.
