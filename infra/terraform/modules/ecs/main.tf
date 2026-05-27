variable "project_name" { type = string }
variable "aws_region" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "target_group_arn" { type = string }
variable "ecr_repository_urls" { type = map(string) }
variable "image_tag" { type = string }
variable "trusted_proxy_cidrs" { type = list(string) }
variable "safezone_db_uri_secret_arn" { type = string }
variable "malicious_db_uri_secret_arn" { type = string }
variable "jwt_secret_arn" { type = string }
variable "socket_token_secret_arn" { type = string }

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-ecs-sg"
  description = "ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
}

resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets" {
  count = (
    var.safezone_db_uri_secret_arn != "" ||
    var.malicious_db_uri_secret_arn != "" ||
    var.jwt_secret_arn != "" ||
    var.socket_token_secret_arn != ""
  ) ? 1 : 0

  name = "${var.project_name}-secrets-read"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = compact([
        var.safezone_db_uri_secret_arn,
        var.malicious_db_uri_secret_arn,
        var.jwt_secret_arn,
        var.socket_token_secret_arn,
      ])
    }]
  })
}

locals {
  trusted_proxy = join(",", var.trusted_proxy_cidrs)
  secrets = concat(
    var.safezone_db_uri_secret_arn != "" ? [
      { name = "SAFEZONE_DB_URI", valueFrom = var.safezone_db_uri_secret_arn },
      { name = "MONGODB_URI", valueFrom = var.safezone_db_uri_secret_arn },
    ] : [],
    var.malicious_db_uri_secret_arn != "" ? [{ name = "MALICIOUS_DB_URI", valueFrom = var.malicious_db_uri_secret_arn }] : [],
    var.jwt_secret_arn != "" ? [
      { name = "JWT_SECRET", valueFrom = var.jwt_secret_arn },
      { name = "GATEWAY_JWT_SECRET", valueFrom = var.jwt_secret_arn },
    ] : [],
    var.socket_token_secret_arn != "" ? [
      { name = "ADMIN_SOCKET_TOKEN", valueFrom = var.socket_token_secret_arn },
      { name = "NEXT_PUBLIC_ADMIN_SOCKET_TOKEN", valueFrom = var.socket_token_secret_arn },
    ] : [],
  )
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-stack"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([
    {
      name      = "nginx"
      image     = "nginx:1.27-alpine"
      essential = true
      portMappings = [{ containerPort = 80, hostPort = 80, protocol = "tcp" }]
      command   = ["/bin/sh", "-c", "cat > /etc/nginx/nginx.conf <<'EOF'\nworker_processes auto;\nevents { worker_connections 1024; }\nhttp {\n  upstream admin_panel { server 127.0.0.1:3000; }\n  upstream gateway { server 127.0.0.1:4001; }\n  upstream telemetry { server 127.0.0.1:3002; }\n  server {\n    listen 80;\n    location /socket.io/ {\n      proxy_pass http://telemetry;\n      proxy_http_version 1.1;\n      proxy_set_header Upgrade $http_upgrade;\n      proxy_set_header Connection \"upgrade\";\n      proxy_set_header Host $host;\n      proxy_set_header X-Real-IP $remote_addr;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n      proxy_set_header X-Forwarded-Proto $scheme;\n    }\n    location /gateway/ {\n      proxy_pass http://gateway/gateway/;\n      proxy_set_header Host $host;\n      proxy_set_header X-Real-IP $remote_addr;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n      proxy_set_header X-Forwarded-Proto $scheme;\n    }\n    location / {\n      proxy_pass http://admin_panel;\n      proxy_set_header Host $host;\n      proxy_set_header X-Real-IP $remote_addr;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n      proxy_set_header X-Forwarded-Proto $scheme;\n    }\n  }\n}\nEOF\nnginx -g 'daemon off;'"]
      dependsOn = [{ containerName = "admin-panel", condition = "START" }]
    },
    {
      name      = "admin-panel"
      image     = "${var.ecr_repository_urls["admin-panel"]}:${var.image_tag}"
      essential = true
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "GATEWAY_ORIGIN", value = "http://127.0.0.1:4001" },
        { name = "TRUSTED_PROXY_IPS", value = local.trusted_proxy },
      ]
      secrets = local.secrets
    },
    {
      name      = "gateway"
      image     = "${var.ecr_repository_urls["gateway"]}:${var.image_tag}"
      essential = true
      portMappings = [{ containerPort = 4001, protocol = "tcp" }]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "4001" },
        { name = "BASE_PATH", value = "/gateway" },
        { name = "TRUSTED_PROXY_IPS", value = local.trusted_proxy },
      ]
      secrets = local.secrets
    },
    {
      name      = "telemetry"
      image     = "${var.ecr_repository_urls["telemetry"]}:${var.image_tag}"
      essential = true
      portMappings = [{ containerPort = 3002, protocol = "tcp" }]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3002" },
        { name = "TRUSTED_PROXY_IPS", value = local.trusted_proxy },
      ]
      secrets = local.secrets
    },
  ])
}

resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "nginx"
    container_port   = 80
  }

}

output "cluster_name" { value = aws_ecs_cluster.main.name }
