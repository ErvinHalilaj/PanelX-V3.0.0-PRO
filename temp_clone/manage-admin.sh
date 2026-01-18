#!/bin/bash

# PanelX Admin User Management Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Default installation directory
INSTALL_DIR="/opt/panelx"

print_banner() {
    clear
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║             PANELX ADMIN USER MANAGEMENT                      ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
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

load_env() {
    if [ -f "${INSTALL_DIR}/.env" ]; then
        export $(cat "${INSTALL_DIR}/.env" | grep -v '^#' | xargs)
    else
        print_error "Environment file not found at ${INSTALL_DIR}/.env"
        exit 1
    fi
}

list_users() {
    echo ""
    echo -e "${BOLD}Current Admin Users:${NC}"
    echo "─────────────────────────────────────────────────"
    
    cd "$INSTALL_DIR"
    node -e "
    const { Pool } = require('pg');
    require('dotenv').config();
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    pool.query('SELECT id, username, role, status, created_at FROM users ORDER BY id')
        .then(result => {
            if (result.rows.length === 0) {
                console.log('No users found');
            } else {
                console.log('ID\tUsername\tRole\t\tStatus\t\tCreated');
                console.log('─'.repeat(70));
                result.rows.forEach(user => {
                    const date = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
                    console.log(\`\${user.id}\t\${user.username}\t\t\${user.role}\t\t\${user.status || 'active'}\t\t\${date}\`);
                });
            }
            pool.end();
        })
        .catch(err => {
            console.error('Error:', err.message);
            pool.end();
            process.exit(1);
        });
    "
    echo ""
}

add_user() {
    echo ""
    echo -e "${BOLD}Add New Admin User${NC}"
    echo "─────────────────────────────────────────────────"
    
    read -p "Username: " username
    if [ -z "$username" ]; then
        print_error "Username cannot be empty"
        return
    fi
    
    read -s -p "Password: " password
    echo
    if [ -z "$password" ]; then
        print_error "Password cannot be empty"
        return
    fi
    
    read -s -p "Confirm password: " password_confirm
    echo
    if [ "$password" != "$password_confirm" ]; then
        print_error "Passwords do not match"
        return
    fi
    
    echo ""
    echo "Select role:"
    echo "  1) admin"
    echo "  2) reseller"
    read -p "Choice [1]: " role_choice
    
    case $role_choice in
        2) role="reseller" ;;
        *) role="admin" ;;
    esac
    
    cd "$INSTALL_DIR"
    node -e "
    const bcrypt = require('bcryptjs');
    const { Pool } = require('pg');
    require('dotenv').config();
    
    const username = '$username';
    const password = '$password';
    const role = '$role';
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    async function addUser() {
        try {
            // Check if user exists
            const existing = await pool.query('SELECT id FROM users WHERE username = \$1', [username]);
            if (existing.rows.length > 0) {
                console.error('User already exists');
                process.exit(1);
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Create user
            await pool.query(
                'INSERT INTO users (username, password, role, credits, status) VALUES (\$1, \$2, \$3, 0, \\'active\\')',
                [username, hashedPassword, role]
            );
            
            console.log('User created successfully');
            pool.end();
        } catch (error) {
            console.error('Error:', error.message);
            pool.end();
            process.exit(1);
        }
    }
    
    addUser();
    "
    
    if [ $? -eq 0 ]; then
        print_success "User '${username}' created with role '${role}'"
    fi
}

change_password() {
    echo ""
    echo -e "${BOLD}Change User Password${NC}"
    echo "─────────────────────────────────────────────────"
    
    read -p "Username: " username
    if [ -z "$username" ]; then
        print_error "Username cannot be empty"
        return
    fi
    
    read -s -p "New password: " password
    echo
    if [ -z "$password" ]; then
        print_error "Password cannot be empty"
        return
    fi
    
    read -s -p "Confirm new password: " password_confirm
    echo
    if [ "$password" != "$password_confirm" ]; then
        print_error "Passwords do not match"
        return
    fi
    
    cd "$INSTALL_DIR"
    node -e "
    const bcrypt = require('bcryptjs');
    const { Pool } = require('pg');
    require('dotenv').config();
    
    const username = '$username';
    const password = '$password';
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    async function changePassword() {
        try {
            // Check if user exists
            const existing = await pool.query('SELECT id FROM users WHERE username = \$1', [username]);
            if (existing.rows.length === 0) {
                console.error('User not found');
                process.exit(1);
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Update password
            await pool.query('UPDATE users SET password = \$1 WHERE username = \$2', [hashedPassword, username]);
            
            console.log('Password changed successfully');
            pool.end();
        } catch (error) {
            console.error('Error:', error.message);
            pool.end();
            process.exit(1);
        }
    }
    
    changePassword();
    "
    
    if [ $? -eq 0 ]; then
        print_success "Password changed for user '${username}'"
    fi
}

delete_user() {
    echo ""
    echo -e "${BOLD}Delete User${NC}"
    echo "─────────────────────────────────────────────────"
    
    read -p "Username to delete: " username
    if [ -z "$username" ]; then
        print_error "Username cannot be empty"
        return
    fi
    
    echo -e "${YELLOW}WARNING: This will permanently delete user '${username}'${NC}"
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Deletion cancelled"
        return
    fi
    
    cd "$INSTALL_DIR"
    node -e "
    const { Pool } = require('pg');
    require('dotenv').config();
    
    const username = '$username';
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    async function deleteUser() {
        try {
            const result = await pool.query('DELETE FROM users WHERE username = \$1 RETURNING id', [username]);
            
            if (result.rowCount === 0) {
                console.error('User not found');
                process.exit(1);
            }
            
            console.log('User deleted successfully');
            pool.end();
        } catch (error) {
            console.error('Error:', error.message);
            pool.end();
            process.exit(1);
        }
    }
    
    deleteUser();
    "
    
    if [ $? -eq 0 ]; then
        print_success "User '${username}' deleted"
    fi
}

show_menu() {
    echo ""
    echo -e "${BOLD}Select an option:${NC}"
    echo "─────────────────────────────────────────────────"
    echo "  1) List all users"
    echo "  2) Add new user"
    echo "  3) Change user password"
    echo "  4) Delete user"
    echo "  5) Exit"
    echo ""
    read -p "Choice [1-5]: " choice
    
    case $choice in
        1) list_users ;;
        2) add_user ;;
        3) change_password ;;
        4) delete_user ;;
        5) echo "Goodbye!"; exit 0 ;;
        *) print_error "Invalid option" ;;
    esac
}

# Main function
main() {
    print_banner
    check_root
    load_env
    
    while true; do
        show_menu
        echo ""
        read -p "Press Enter to continue..."
        print_banner
    done
}

# Run main function
main "$@"
