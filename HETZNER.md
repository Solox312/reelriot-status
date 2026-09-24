# Technical Manual: ReelRiot Status Server Provisioning & Co-Hosting Guide (Hetzner Cloud)

**Document Identifier:** `DOC-SOP-HETZNER-RRSTATUS-001`  
**Standard Compliance:** IEC/IEEE 82079-1:2019 (*Preparation of information for use of products*)  
**Version:** `1.0.0`  
**Effective Date:** 2026-09-23  
**Target Product:** ReelRiot Status / `rr-status` (`v0.1.0+`, Next.js 16.2.4 / React 19.2.4)  
**Co-Hosted Product:** ReelRiot Web / `rr-web` (`v0.1.0+`, Next.js 16.2.1 / React 19.2.4)  
**Publisher:** Infrastructure & DevOps Engineering  

---

## 1. Scope, Purpose, and Target Audience

### 1.1 Scope & Purpose
This standard operating procedure provides normative technical instructions for provisioning, configuring, deploying, and maintaining the **ReelRiot Status** (`rr-status`) monitoring application alongside **ReelRiot Web** (`rr-web`) on a single **Hetzner Cloud** Linux host. The procedure details OCI containerization (Next.js standalone mode on loopback port `3003`), Nginx Server Name Indication (SNI) multi-site routing, static asset optimization, and independent Let's Encrypt TLS certificate lifecycle management.

### 1.2 Target Audience & Qualifications
This document is prepared for **Systems Administrators**, **Site Reliability Engineers (SREs)**, and **DevOps Engineers**. Personnel executing these procedures shall possess:
- Operational competence in Linux systems administration (Ubuntu 24.04 LTS / 22.04 LTS).
- Working knowledge of OCI container standards (Docker Engine, BuildKit) and Next.js standalone runtime mechanics.
- Proficiency in TCP/IP networking, DNS management, Nginx reverse proxy architecture, and Let's Encrypt TLS certificate lifecycle management.

---

## 2. Safety Information, Risk Assessment, and Typographical Conventions

### 2.1 Warning Signs and Signal Words
This document employs hazard classification symbols and signal words in strict compliance with ISO 3864, ANSI Z535, and IEC/IEEE 82079-1 Clause 7:

> [!DANGER]
> **DANGER:** Never publish upstream application ports (`3000`, `3003`) to `0.0.0.0` or `[::]`. All application containers must bind strictly to the loopback interface (`127.0.0.1`) to ensure all incoming traffic passes through Nginx security controls.

> [!WARNING]
> **WARNING:** Always execute `nginx -t` prior to reloading Nginx. A syntactical error in the Nginx configuration will cause reverse proxy failure across both `status.reelriot.app` and `reelriot.app`.

> [!CAUTION]
> **CAUTION:** Next.js compilation consumes significant CPU and RAM. Stagger application builds; never rebuild `rr-web` and `rr-status` concurrently. Verify that active swap space is at least 4 GB before initiating builds.

> [!NOTE]
> **NOTICE:** `rr-status` polls health status from `https://caffeine.synqholdings.com/status/health`. Host outbound network egress on port 443 must remain unrestricted.

### 2.2 Typographical Conventions
- `monospace`: System commands, terminal output, file paths, configuration keys, and environment variables.
- `<variable>`: User-defined parameters and values that must be substituted prior to command execution.

---

## 3. System Description & Technical Specifications

### 3.1 Architecture Overview
Both applications run as isolated Docker containers on the Hetzner host. Nginx serves as the edge reverse proxy, managing TLS termination, gzip compression, and caching for static Next.js assets (`/_next/static/*`), while proxying dynamic requests to the respective container on `127.0.0.1`.

```
                        [ Inbound Web Traffic ]
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
    https://reelriot.app                    https://status.reelriot.app
               │                                       │
               └───────────────────┬───────────────────┘
                                   │
                                   ▼
                     [ Hetzner Cloud Server Host ]
               ┌───────────────────────────────────────┐
               │    Hetzner Cloud Host OS (Ubuntu)     │
               │    Nginx Edge Reverse Proxy (80/443)  │
               └───────────────┬───────┬───────────────┘
                               │       │
              SNI: reelriot.app│       │SNI: status.reelriot.app
                               ▼       ▼
                       127.0.0.1:3000  127.0.0.1:3003
                               │       │
                   ┌───────────┘       └───────────┐
                   ▼                               ▼
       ┌────────────────────────┐      ┌────────────────────────┐
       │ Container: `rr-web`    │      │ Container: `rr-status` │
       │ Next.js 16 Standalone  │      │ Next.js 16 Standalone  │
       │ Host Port: 3000        │      │ Host Port: 3003        │
       │ Memory Limit: 2048 MB  │      │ Memory Limit: 1024 MB  │
       └────────────────────────┘      └────────────────────────┘
```

### 3.2 Port & Resource Allocation Matrix

| Service Identifier | Host Interface | Host Port | Container Port | Public FQDN | Memory Cap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`reelriot-web`** | `127.0.0.1` | `3000` | `3000` | `reelriot.app`, `www.reelriot.app` | `2048 MB` |
| **`reelriot-status`** | `127.0.0.1` | `3003` | `3003` | `status.reelriot.app` | `1024 MB` |
| **Nginx (Edge Proxy)**| `0.0.0.0`, `[::]` | `80`, `443` | N/A (Host) | All domains | System shared |

---

## 4. Step-by-Step Provisioning & Deployment Instructions

### 4.1 Phase 1: DNS Record Configuration

#### Preconditions
- Administrative access to DNS zone management for `reelriot.app`.
- Public IPv4 and IPv6 addresses of the Hetzner server.

#### Procedure
1. Create DNS zone records at your DNS registrar:
   - **Type:** `A`
   - **Host / Name:** `status` (resolving `status.reelriot.app`)
   - **Target / Value:** `<HETZNER_PUBLIC_IPV4>`
   - **TTL:** `300` seconds
2. *(Optional)* Add the `AAAA` record if IPv6 is utilized:
   - **Type:** `AAAA`
   - **Host / Name:** `status`
   - **Target / Value:** `<HETZNER_PUBLIC_IPV6>`
   - **TTL:** `300` seconds
3. Verify DNS resolution:
   ```bash
   dig +short status.reelriot.app
   ```
   *Expected Result:* Returns your Hetzner public IPv4 address.

---

### 4.2 Phase 2: Host Application Deployment

#### Preconditions
- SSH administrative access to the Hetzner host (`root` or `sudo`).
- Docker Engine and Buildx operational on host.

#### Procedure
1. Establish SSH connection:
   ```bash
   ssh root@<HETZNER_PUBLIC_IPV4>
   ```

2. Clone repository to `/opt/reelriot-status`:
   ```bash
   cd /opt
   git clone <GIT_REPO_URL_FOR_REELRIOT_STATUS> reelriot-status
   cd /opt/reelriot-status
   ```

3. Ensure deployment script is executable:
   ```bash
   chmod +x scripts/restart-hetzner.sh
   ```

4. Execute container build and launch:
   ```bash
   /opt/reelriot-status/scripts/restart-hetzner.sh
   ```

5. Confirm container state:
   ```bash
   docker ps -f name=reelriot-status
   ```
   *Expected Result:* Status displays `Up` with port binding `127.0.0.1:3003->3003/tcp`.

6. Validate local loopback responsiveness:
   ```bash
   curl -I http://127.0.0.1:3003
   ```
   *Expected Result:* `HTTP/1.1 200 OK`.

---

### 4.3 Phase 3: Nginx Reverse Proxy & TLS Configuration

#### Preconditions
- Port `80` and `443` open in Hetzner Cloud Firewall (`fw-reelriot-web`).
- DNS `A` record for `status.reelriot.app` actively pointing to the host.
- `reelriot-status` container running on `127.0.0.1:3003`.

#### Procedure
1. Create bootstrap Nginx configuration for ACME challenge validation:
   ```bash
   cat << 'EOF' > /etc/nginx/sites-available/reelriot-status
   server {
       listen 80;
       listen [::]:80;
       server_name status.reelriot.app;

       location /.well-known/acme-challenge/ {
           root /var/www/certbot;
       }

       location / {
           proxy_pass http://127.0.0.1:3003;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   EOF
   ```

2. Enable the site configuration:
   ```bash
   ln -sf /etc/nginx/sites-available/reelriot-status /etc/nginx/sites-enabled/
   ```

3. Test configuration syntax and reload Nginx:
   ```bash
   nginx -t
   systemctl reload nginx
   ```
   *Expected Result:* `nginx: configuration file /etc/nginx/nginx.conf test is successful`.

4. Request Let's Encrypt TLS certificate:
   ```bash
   certbot --nginx -d status.reelriot.app
   ```

5. Replace with the hardened production configuration from `/opt/reelriot-status/nginx/reelriot-status.conf`:
   ```bash
   cp /opt/reelriot-status/nginx/reelriot-status.conf /etc/nginx/sites-available/reelriot-status
   nginx -t
   systemctl reload nginx
   ```

---

## 5. Verification & Acceptance Testing

Execute the following verification checklist to confirm multi-tenant health:

| Step | Verification Command | Expected Output | Status |
| :--- | :--- | :--- | :--- |
| **1. Docker Isolation** | `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"` | Shows both `reelriot-web` (`:3000`) and `reelriot-status` (`:3003`) as `Up` | `[ ]` |
| **2. Status App Health** | `curl -I https://status.reelriot.app` | `HTTP/2 200` with strict SSL headers | `[ ]` |
| **3. Web App Non-Regression** | `curl -I https://reelriot.app` | `HTTP/2 200` unaffected | `[ ]` |
| **4. ACME Auto-Renewal** | `certbot renew --dry-run` | `Congratulations, all simulated renewals succeeded` | `[ ]` |

---

## 6. Maintenance & Troubleshooting

### 6.1 Diagnostic Commands
- **View status container runtime logs:**
  ```bash
  docker logs -f --tail 100 reelriot-status
  ```
- **Inspect Nginx reverse proxy error logs:**
  ```bash
  tail -f /var/log/nginx/error.log
  ```
- **Redeploy application after git updates:**
  ```bash
  cd /opt/reelriot-status && ./scripts/restart-hetzner.sh --pull
  ```

### 6.2 Fault Diagnosis Matrix

| Fault / Symptom | Root Cause | Corrective Action |
| :--- | :--- | :--- |
| `502 Bad Gateway` on `status.reelriot.app` | Container is stopped or crashing on port 3003 | Inspect container with `docker ps -a` and check logs: `docker logs reelriot-status`. Ensure port `3003` is mapped to `127.0.0.1`. |
| `nginx: [emerg] bind() to 0.0.0.0:80 failed` | Port 80 locked by another process | Check port 80 owner: `ss -tulpn \| grep :80`. Terminate conflicting process. |
| Host Memory Exhaustion (OOM) | Rebuilding both Next.js apps simultaneously | Build images sequentially. Verify 4 GB swap file is active (`swapon --show`). |
