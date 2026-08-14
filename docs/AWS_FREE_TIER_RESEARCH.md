# AWS deployment research — 14 August 2026

## Official sources

1. AWS Free Tier: https://aws.amazon.com/free/
   - New AWS Free Tier accounts receive $100 in credits immediately and can earn up to another $100.
   - The Free account plan provides access to over 90 services for up to six months, and AWS states that it does not charge unless the account is upgraded to a Paid plan or a paid-only service is activated.
   - Always-Free offerings have monthly limits; exceeding limits or using paid features can consume credits or incur charges depending on the plan.

2. AWS container offers: https://aws.amazon.com/free/containers/
   - AWS lists EC2 eligible instances for the Free Tier, including T3.micro, T3.small, T4g.micro, T4g.small, C7i-flex.large, and M7i-flex.large, subject to account/offer conditions.
   - ECR and ECS-related container features are listed in the AWS Free Tier container offers, but the exact eligible usage depends on the active account plan and offer.
   - Lightsail Linux/Unix instances have a 90-day free trial on the Paid plan for selected $5/$7/$12 bundles.

3. Lightsail pricing: https://aws.amazon.com/lightsail/pricing/
   - Linux/Unix public IPv4 bundles shown by AWS include $5/month for 0.5 GB RAM, 2 vCPUs, 20 GB SSD, and 1 TB transfer; $7/month for 1 GB RAM, 2 vCPUs, 40 GB SSD, and 2 TB transfer; and $12/month for 2 GB RAM, 2 vCPUs, 60 GB SSD, and 3 TB transfer.
   - Lightsail container service pricing shown by AWS starts at $7/month for a Nano node with 0.25 shared vCPU and 512 MB RAM, $10/month for Micro with 1 GB RAM, and $15/month for Small with 1 GB RAM and 0.5 vCPU.
   - Lightsail managed database pricing shown by AWS starts at $15/month for a 1 GB/1-core/40 GB standard database without encryption; a higher $30/month standard plan provides 2 GB/1 core/80 GB and encryption.
   - Lightsail load balancer is listed at $18/month; object storage starts at $1/month; snapshots are listed at $0.05/GB-month.
   - Lightsail container services include 500 GB/month transfer quota; excess transfer begins at region-dependent rates starting at $0.09/GB.

4. AWS Free Tier documentation: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html
   - AWS distinguishes Free account and Paid account plans.
   - Free account plans end after six months or when credits are exhausted, whichever comes first, and cannot access some services that could consume credits rapidly.
   - Paid accounts can incur standard pay-as-you-go charges beyond credits or when using services/features not covered by applicable offers.

## Deployment implication

For the smallest Job Tayari footprint, a single EC2 Free-Tier-eligible instance or a single Lightsail VM is cheaper and operationally simpler than ECS/Fargate plus a load balancer plus managed Redis and managed PostgreSQL. However, a single host is not high availability and must be treated as a manual-submit canary only. The repository currently needs Go gateway, Python API, Celery worker, Redis, and PostgreSQL/Supabase connectivity; Chromium/Playwright and Typst make the Python/worker images heavier than a basic web app. A split architecture using managed Supabase/PostgreSQL and Redis plus one small compute host reduces host complexity but is not necessarily Free Tier and requires provider-specific pricing verification.
