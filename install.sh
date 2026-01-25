#!/bin/bash

###############################################################################
# PanelX V3.0.0 PRO - Complete Installation & Setup Script
# Installs all dependencies, configures database, builds frontend, and starts services
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emoji support
CHECK_MARK="✅"
CROSS_MARK="❌"
ROCKET="🚀"
GEAR="⚙️"
DATABASE="🗄️"
PACKAGE="📦"
BUILD="🔨"
TEST="🧪"
WARN="⚠️"

# Functions
print_header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}${CHECK_MARK} $1${NC}"
}

print_error() {
    echo -e "${RED}${CROSS_MARK} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}${WARN} $1${NC}"
}

print_info() {
    echo -e "${BLUE}${GEAR} $1${NC}"
}

print_step() {
    echo -e "\n${PURPLE}▶ $1${NC}"
}

# Check if running in correct directory
check_directory() {
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root directory."
        exit 1
    fi
    print_success "Running in correct directory"
}

# Check Node.js version
check_node() {
    print_step "Checking Node.js version..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v) detected"
}

# Check npm
check_npm() {
    print_step "Checking npm..."
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    print_success "npm $(npm -v) detected"
}

# Check PM2
check_pm2() {
    print_step "Checking PM2..."
    if ! command -v pm2 &> /dev/null; then
        print_warning "PM2 not found. Installing PM2 globally..."
        npm install -g pm2
        print_success "PM2 installed"
    else
        print_success "PM2 $(pm2 -v) detected"
    fi
}

# Clean old installations
clean_install() {
    print_step "Cleaning old installation..."
    rm -rf node_modules
    rm -rf dist
    rm -rf .wrangler/state
    rm -f package-lock.json
    print_success "Old installation cleaned"
}

# Install dependencies
install_dependencies() {
    print_step "Installing dependencies..."
    print_info "This may take a few minutes..."
    
    npm install --legacy-peer-deps --timeout=300000 2>&1 | tail -20
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Setup environment file
setup_env() {
    print_step "Setting up environment..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env from .env.example"
        else
            print_warning "No .env.example found, creating basic .env"
            cat > .env << EOF
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/panelx

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=$(openssl rand -base64 32)

# Session
SESSION_SECRET=$(openssl rand -base64 32)

# CDN (optional)
CDN_URL=

# TMDB (optional)
TMDB_API_KEY=

# Email (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EOF
            print_success "Created basic .env file"
        fi
    else
        print_success ".env file already exists"
    fi
}

# Initialize database
init_database() {
    print_step "Initializing database..."
    
    # Check if wrangler is available
    if ! command -v wrangler &> /dev/null; then
        print_info "Installing wrangler..."
        npm install -g wrangler
    fi
    
    # Create local D1 database if configured
    if grep -q "d1_databases" wrangler.jsonc 2>/dev/null; then
        print_info "Applying database migrations..."
        npm run db:migrate:local 2>&1 | tail -10 || print_warning "Migrations skipped (may already be applied)"
        print_success "Database initialized"
    else
        print_warning "No D1 database configured in wrangler.jsonc"
    fi
}

# Build frontend
build_frontend() {
    print_step "Building frontend..."
    print_info "This may take a few minutes..."
    
    # Increase Node memory for build
    export NODE_OPTIONS="--max-old-space-size=4096"
    
    npm run build 2>&1 | tail -30
    
    if [ $? -eq 0 ]; then
        print_success "Frontend built successfully"
        
        # Check if dist directory exists and has files
        if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
            print_success "Build output verified in dist/"
        else
            print_error "Build completed but dist/ directory is empty"
            exit 1
        fi
    else
        print_error "Frontend build failed"
        print_info "Try running with more memory: NODE_OPTIONS='--max-old-space-size=8192' npm run build"
        exit 1
    fi
}

# Setup PM2 ecosystem
setup_pm2() {
    print_step "Setting up PM2 configuration..."
    
    if [ ! -f "ecosystem.config.cjs" ]; then
        print_info "Creating PM2 ecosystem config..."
        cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'panelx',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
EOF
        print_success "PM2 configuration created"
    else
        print_success "PM2 configuration already exists"
    fi
}

# Start services
start_services() {
    print_step "Starting services..."
    
    # Kill any existing processes on port 3000
    print_info "Cleaning port 3000..."
    fuser -k 3000/tcp 2>/dev/null || true
    
    # Stop any existing PM2 processes
    pm2 delete panelx 2>/dev/null || true
    
    # Start with PM2
    print_info "Starting PanelX with PM2..."
    pm2 start ecosystem.config.cjs
    
    # Wait for service to start
    print_info "Waiting for service to start..."
    sleep 5
    
    # Check if service is running
    if pm2 list | grep -q "panelx.*online"; then
        print_success "Services started successfully"
        return 0
    else
        print_error "Failed to start services"
        pm2 logs panelx --nostream --lines 20
        return 1
    fi
}

# Test service
test_service() {
    print_step "Testing service..."
    
    # Wait a bit more for service to be ready
    sleep 3
    
    # Test health endpoint
    if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Service is responding on http://localhost:3000"
        return 0
    else
        print_error "Service is not responding"
        print_info "Checking PM2 logs..."
        pm2 logs panelx --nostream --lines 30
        return 1
    fi
}

# Display summary
display_summary() {
    print_header "${ROCKET} Installation Complete!"
    
    echo -e "${GREEN}PanelX V3.0.0 PRO is now installed and running!${NC}\n"
    
    echo -e "${CYAN}📊 Service Information:${NC}"
    echo -e "  ${BLUE}•${NC} Status: ${GREEN}Running${NC}"
    echo -e "  ${BLUE}•${NC} URL: ${GREEN}http://localhost:3000${NC}"
    echo -e "  ${BLUE}•${NC} Process Manager: ${GREEN}PM2${NC}\n"
    
    echo -e "${CYAN}🔧 Useful Commands:${NC}"
    echo -e "  ${BLUE}•${NC} Check status:    ${YELLOW}pm2 status${NC}"
    echo -e "  ${BLUE}•${NC} View logs:       ${YELLOW}pm2 logs panelx${NC}"
    echo -e "  ${BLUE}•${NC} Restart:         ${YELLOW}pm2 restart panelx${NC}"
    echo -e "  ${BLUE}•${NC} Stop:            ${YELLOW}pm2 stop panelx${NC}"
    echo -e "  ${BLUE}•${NC} Delete:          ${YELLOW}pm2 delete panelx${NC}\n"
    
    echo -e "${CYAN}📚 Documentation:${NC}"
    echo -e "  ${BLUE}•${NC} README.md"
    echo -e "  ${BLUE}•${NC} PHASE4_5_COMPLETE_REPORT.md"
    echo -e "  ${BLUE}•${NC} FINAL_COMPLETION_REPORT.md\n"
    
    echo -e "${GREEN}${ROCKET} Ready to use! Open http://localhost:3000 in your browser${NC}\n"
}

# Main installation flow
main() {
    print_header "${ROCKET} PanelX V3.0.0 PRO - Installation"
    
    echo -e "${CYAN}This script will:${NC}"
    echo -e "  1. ${BLUE}Check system requirements${NC}"
    echo -e "  2. ${BLUE}Clean old installations${NC}"
    echo -e "  3. ${BLUE}Install dependencies${NC}"
    echo -e "  4. ${BLUE}Setup environment${NC}"
    echo -e "  5. ${BLUE}Initialize database${NC}"
    echo -e "  6. ${BLUE}Build frontend${NC}"
    echo -e "  7. ${BLUE}Setup PM2${NC}"
    echo -e "  8. ${BLUE}Start services${NC}"
    echo -e "  9. ${BLUE}Test service${NC}\n"
    
    read -p "Continue with installation? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Installation cancelled"
        exit 0
    fi
    
    # Run installation steps
    check_directory
    check_node
    check_npm
    check_pm2
    
    if [ "$1" == "--full" ] || [ "$1" == "-f" ]; then
        clean_install
    fi
    
    install_dependencies
    setup_env
    init_database
    build_frontend
    setup_pm2
    
    if start_services && test_service; then
        display_summary
        exit 0
    else
        print_error "Installation completed but service failed to start"
        print_info "Check the logs with: pm2 logs panelx"
        exit 1
    fi
}

# Handle script arguments
case "$1" in
    --help|-h)
        echo "PanelX V3.0.0 PRO Installation Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --full, -f       Clean installation (removes node_modules)"
        echo "  --help, -h       Show this help message"
        echo ""
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
