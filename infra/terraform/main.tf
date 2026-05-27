module "vpc" {
  source       = "./modules/vpc"
  project_name = var.project_name
}

module "ecr" {
  source       = "./modules/ecr"
  project_name = var.project_name
}

module "alb" {
  source              = "./modules/alb"
  project_name        = var.project_name
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  acm_certificate_arn = var.acm_certificate_arn
}

module "ecs" {
  source                    = "./modules/ecs"
  project_name              = var.project_name
  aws_region                = var.aws_region
  vpc_id                    = module.vpc.vpc_id
  private_subnet_ids        = module.vpc.private_subnet_ids
  alb_security_group_id     = module.alb.alb_security_group_id
  target_group_arn          = module.alb.target_group_arn
  ecr_repository_urls       = module.ecr.repository_urls
  image_tag                 = var.image_tag
  trusted_proxy_cidrs       = var.trusted_proxy_cidrs
  safezone_db_uri_secret_arn  = var.safezone_db_uri_secret_arn
  malicious_db_uri_secret_arn = var.malicious_db_uri_secret_arn
  jwt_secret_arn            = var.jwt_secret_arn
  socket_token_secret_arn   = var.socket_token_secret_arn
}
