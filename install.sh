#!/bin/bash

# PanelX IPTV Management Panel Installer
# Compatible with Ubuntu 20.04, 22.04, 24.04

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Default values
INSTALL_DIR="/opt/panelx"
NODE_VERSION="20"
DB_NAME="panelx"
DB_USER="panelx"
SERVICE_NAME="panelx"
PORT=5000

# Functions
print_banner() {
    clear
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║     ██████╗  █████╗ ███╗   ██╗███████╗██╗     ██╗  ██╗        ║"
    echo "║     ██╔══██╗██╔══██╗████╗  ██║██╔════╝██║     ╚██╗██╔╝        ║"
    echo "║     ██████╔╝███████║██╔██╗ ██║█████╗  ██║      ╚███╔╝         ║"
    echo "║     ██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║      ██╔██╗         ║"
    echo "║     ██║     ██║  ██║██║ ╚████║███████╗███████╗██╔╝ ╚██╗       ║"
    echo "║     ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝   ╚═╝       ║"
    echo "║                                                               ║"
    echo "║           IPTV Management Panel - Installer v3.0.0            ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (sudo)"
        exit 1
    fi
}

check_ubuntu() {
    if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
        print_warning "This script is designed for Ubuntu. Other distributions may not work correctly."
        read -p "Continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_system_requirements() {
    print_step "Checking system requirements..."
    
    # Check RAM (minimum 1GB recommended)
    TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_RAM" -lt 1024 ]; then
        print_warning "System has less than 1GB RAM. Performance may be affected."
    else
        print_success "RAM: ${TOTAL_RAM}MB"
    fi
    
    # Check disk space (minimum 5GB)
    FREE_SPACE=$(df -m / | awk 'NR==2 {print $4}')
    if [ "$FREE_SPACE" -lt 5120 ]; then
        print_error "Insufficient disk space. At least 5GB required."
        exit 1
    else
        print_success "Disk space: ${FREE_SPACE}MB free"
    fi
}

install_dependencies() {
    print_step "Installing system dependencies..."
    
    apt-get update -qq
    apt-get install -y -qq curl wget gnupg2 ca-certificates lsb-release apt-transport-https software-properties-common git
    
    print_success "System dependencies installed"
}

install_nodejs() {
    print_step "Installing Node.js ${NODE_VERSION}..."
    
    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$CURRENT_NODE" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) already installed"
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
    
    print_success "Node.js $(node -v) installed"
}

install_postgresql() {
    print_step "Installing PostgreSQL..."
    
    if command -v psql &> /dev/null; then
        print_success "PostgreSQL already installed"
    else
        apt-get install -y -qq postgresql postgresql-contrib
    fi
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    print_success "PostgreSQL installed and running"
}

generate_password() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24
}

setup_database() {
    print_step "Setting up database..."
    
    DB_PASSWORD=$(generate_password)
    
    # Create database user and database
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
    sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
    
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
    
    print_success "Database created successfully"
}

wizard_get_config() {
    echo ""
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}                    INSTALLATION WIZARD                        ${NC}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Installation directory
    read -p "Installation directory [${INSTALL_DIR}]: " input_dir
    INSTALL_DIR=${input_dir:-$INSTALL_DIR}
    
    # Port
    read -p "Web server port [${PORT}]: " input_port
    PORT=${input_port:-$PORT}
    
    # Admin credentials
    echo ""
    echo -e "${BOLD}Admin Account Setup${NC}"
    echo "─────────────────────────────────────────────────"
    
    while true; do
        read -p "Admin username: " ADMIN_USERNAME
        if [ -z "$ADMIN_USERNAME" ]; then
            print_error "Username cannot be empty"
        elif [ ${#ADMIN_USERNAME} -lt 3 ]; then
            print_error "Username must be at least 3 characters"
        else
            break
        fi
    done
    
    while true; do
        read -s -p "Admin password: " ADMIN_PASSWORD
        echo
        if [ -z "$ADMIN_PASSWORD" ]; then
            print_error "Password cannot be empty"
        elif [ ${#ADMIN_PASSWORD} -lt 6 ]; then
            print_error "Password must be at least 6 characters"
        else
            read -s -p "Confirm password: " ADMIN_PASSWORD_CONFIRM
            echo
            if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; then
                print_error "Passwords do not match"
            else
                break
            fi
        fi
    done
    
    # Session secret
    SESSION_SECRET=$(generate_password)
    
    echo ""
    echo -e "${BOLD}Configuration Summary${NC}"
    echo "─────────────────────────────────────────────────"
    echo -e "Install directory: ${GREEN}${INSTALL_DIR}${NC}"
    echo -e "Web port:          ${GREEN}${PORT}${NC}"
    echo -e "Admin username:    ${GREEN}${ADMIN_USERNAME}${NC}"
    echo -e "Admin password:    ${GREEN}********${NC}"
    echo ""
    
    read -p "Proceed with installation? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi
}

download_panelx() {
    print_step "Downloading PanelX..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    
    # Clone or copy files
    if [ -d ".git" ]; then
        # If running from git repo, copy files
        cp -r . "$INSTALL_DIR/"
    else
        # Download from GitHub
        git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git "$INSTALL_DIR"
    fi
    
    cd "$INSTALL_DIR"
    
    print_success "PanelX downloaded to ${INSTALL_DIR}"
}

install_npm_packages() {
    print_step "Installing Node.js packages..."
    
    cd "$INSTALL_DIR"
    npm install --production=false
    
    print_success "Node.js packages installed"
}

create_env_file() {
    print_step "Creating environment configuration..."
    
    cat > "$INSTALL_DIR/.env" << EOF
# PanelX Configuration
# Generated by installer on $(date)

DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
PORT=${PORT}
NODE_ENV=production
EOF
    
    chmod 600 "$INSTALL_DIR/.env"
    
    print_success "Environment configuration created"
}

setup_initial_admin() {
    print_step "Setting up initial admin user..."
    
    cd "$INSTALL_DIR"
    
    # Create a setup script to initialize the admin user (ES module compatible)
    cat > "$INSTALL_DIR/setup-admin.mjs" << 'EOFJS'
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.argv[2];
const username = process.argv[3];
const password = process.argv[4];

if (!databaseUrl || !username || !password) {
    console.error('Usage: node setup-admin.mjs <database_url> <username> <password>');
    process.exit(1);
}

async function setupAdmin() {
    const pool = new Pool({ connectionString: databaseUrl });
    
    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Check if admin exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        
        if (existing.rows.length > 0) {
            // Update existing admin
            await pool.query(
                'UPDATE users SET password = $1 WHERE username = $2',
                [hashedPassword, username]
            );
            console.log('Admin user updated successfully');
        } else {
            // Create new admin
            await pool.query(
                `INSERT INTO users (username, password, role, credits, status) 
                 VALUES ($1, $2, 'admin', 0, 'active')`,
                [username, hashedPassword]
            );
            console.log('Admin user created successfully');
        }
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('Error setting up admin:', error.message);
        await pool.end();
        process.exit(1);
    }
}

setupAdmin();
EOFJS
    
    # Build the application first
    npm run build 2>/dev/null || true
    
    # Push database schema
    npm run db:push 2>/dev/null || npx drizzle-kit push 2>/dev/null || true
    
    # Create admin user (pass DATABASE_URL directly as argument)
    node setup-admin.mjs "$DATABASE_URL" "$ADMIN_USERNAME" "$ADMIN_PASSWORD"
    
    # Remove setup script
    rm -f setup-admin.mjs
    
    print_success "Admin user created"
}

create_systemd_service() {
    print_step "Creating systemd service..."
    
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=PanelX IPTV Management Panel
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/node ${INSTALL_DIR}/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    
    print_success "Systemd service created"
}

start_panelx() {
    print_step "Starting PanelX..."
    
    systemctl start ${SERVICE_NAME}
    sleep 3
    
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        print_success "PanelX is running"
    else
        print_error "Failed to start PanelX"
        systemctl status ${SERVICE_NAME}
        exit 1
    fi
}

configure_firewall() {
    print_step "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow ${PORT}/tcp 2>/dev/null || true
        print_success "Firewall configured for port ${PORT}"
    else
        print_info "UFW not installed, skipping firewall configuration"
    fi
}

print_completion() {
    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║              INSTALLATION COMPLETED SUCCESSFULLY!             ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${BOLD}Access your PanelX installation:${NC}"
    echo "─────────────────────────────────────────────────"
    echo -e "  URL:       ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
    echo -e "  Username:  ${CYAN}${ADMIN_USERNAME}${NC}"
    echo -e "  Password:  ${CYAN}********${NC}"
    echo ""
    echo -e "${BOLD}Useful commands:${NC}"
    echo "─────────────────────────────────────────────────"
    echo -e "  Start:     ${YELLOW}systemctl start ${SERVICE_NAME}${NC}"
    echo -e "  Stop:      ${YELLOW}systemctl stop ${SERVICE_NAME}${NC}"
    echo -e "  Restart:   ${YELLOW}systemctl restart ${SERVICE_NAME}${NC}"
    echo -e "  Status:    ${YELLOW}systemctl status ${SERVICE_NAME}${NC}"
    echo -e "  Logs:      ${YELLOW}journalctl -u ${SERVICE_NAME} -f${NC}"
    echo ""
    echo -e "${BOLD}Installation directory:${NC} ${INSTALL_DIR}"
    echo -e "${BOLD}Configuration file:${NC} ${INSTALL_DIR}/.env"
    echo ""
    echo -e "${BOLD}To uninstall:${NC} ${YELLOW}bash ${INSTALL_DIR}/uninstall.sh${NC}"
    echo ""
    
    # Save installation info
    cat > "${INSTALL_DIR}/install.info" << EOF
INSTALL_DIR=${INSTALL_DIR}
PORT=${PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
SERVICE_NAME=${SERVICE_NAME}
INSTALLED_DATE=$(date)
EOF
    
    chmod 600 "${INSTALL_DIR}/install.info"
}

# Main installation flow
main() {
    print_banner
    
    check_root
    check_ubuntu
    check_system_requirements
    wizard_get_config
    
    echo ""
    print_step "Starting installation..."
    echo ""
    
    install_dependencies
    install_nodejs
    install_postgresql
    setup_database
    download_panelx
    install_npm_packages
    create_env_file
    setup_initial_admin
    create_systemd_service
    configure_firewall
    start_panelx
    print_completion
}

# Run main function
main "$@"
