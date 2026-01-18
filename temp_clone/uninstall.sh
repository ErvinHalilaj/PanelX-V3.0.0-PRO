#!/bin/bash

# PanelX IPTV Management Panel Uninstaller

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
SERVICE_NAME="panelx"
DB_NAME="panelx"
DB_USER="panelx"

print_banner() {
    clear
    echo -e "${RED}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║                  PANELX UNINSTALLER                           ║"
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

load_install_info() {
    if [ -f "${INSTALL_DIR}/install.info" ]; then
        source "${INSTALL_DIR}/install.info"
        print_info "Loaded installation info from ${INSTALL_DIR}/install.info"
    fi
}

confirm_uninstall() {
    echo ""
    echo -e "${BOLD}${RED}WARNING: This will completely remove PanelX from your system!${NC}"
    echo ""
    echo "The following will be removed:"
    echo "  - PanelX application files (${INSTALL_DIR})"
    echo "  - Systemd service (${SERVICE_NAME})"
    echo ""
    
    read -p "Do you want to also remove the database? (y/n): " -n 1 -r
    echo
    REMOVE_DB=$REPLY
    
    echo ""
    read -p "Are you sure you want to uninstall PanelX? (type 'yes' to confirm): " confirm
    if [ "$confirm" != "yes" ]; then
        print_info "Uninstallation cancelled"
        exit 0
    fi
}

stop_service() {
    print_step "Stopping PanelX service..."
    
    if systemctl is-active --quiet ${SERVICE_NAME} 2>/dev/null; then
        systemctl stop ${SERVICE_NAME}
        print_success "Service stopped"
    else
        print_info "Service was not running"
    fi
}

remove_service() {
    print_step "Removing systemd service..."
    
    if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
        systemctl disable ${SERVICE_NAME} 2>/dev/null || true
        rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
        systemctl daemon-reload
        print_success "Systemd service removed"
    else
        print_info "No systemd service found"
    fi
}

remove_database() {
    if [[ $REMOVE_DB =~ ^[Yy]$ ]]; then
        print_step "Removing database..."
        
        if command -v psql &> /dev/null; then
            sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
            sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" 2>/dev/null || true
            print_success "Database removed"
        else
            print_warning "PostgreSQL not found, skipping database removal"
        fi
    else
        print_info "Database preserved as requested"
    fi
}

remove_files() {
    print_step "Removing application files..."
    
    if [ -d "${INSTALL_DIR}" ]; then
        rm -rf "${INSTALL_DIR}"
        print_success "Application files removed from ${INSTALL_DIR}"
    else
        print_info "Installation directory not found"
    fi
}

remove_firewall_rule() {
    print_step "Removing firewall rules..."
    
    if command -v ufw &> /dev/null; then
        # Get port from install.info or use default
        PORT=${PORT:-5000}
        ufw delete allow ${PORT}/tcp 2>/dev/null || true
        print_success "Firewall rules removed"
    else
        print_info "UFW not installed, skipping"
    fi
}

print_completion() {
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║              UNINSTALLATION COMPLETED SUCCESSFULLY!           ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "PanelX has been removed from your system."
    echo ""
    if [[ ! $REMOVE_DB =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Note: Database was preserved. To remove it manually:${NC}"
        echo "  sudo -u postgres psql -c \"DROP DATABASE ${DB_NAME};\""
        echo "  sudo -u postgres psql -c \"DROP USER ${DB_USER};\""
        echo ""
    fi
    echo "Thank you for using PanelX!"
    echo ""
}

# Main uninstallation flow
main() {
    print_banner
    
    check_root
    load_install_info
    confirm_uninstall
    
    echo ""
    print_step "Starting uninstallation..."
    echo ""
    
    stop_service
    remove_service
    remove_database
    remove_files
    remove_firewall_rule
    print_completion
}

# Run main function
main "$@"
