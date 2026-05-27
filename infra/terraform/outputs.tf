output "alb_dns_name" {
  value       = module.alb.alb_dns_name
  description = "Public ALB hostname — point your DNS CNAME here"
}

output "ecr_repository_urls" {
  value       = module.ecr.repository_urls
  description = "Push container images here before ECS deploy"
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}
