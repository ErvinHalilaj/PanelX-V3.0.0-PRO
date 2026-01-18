# PanelX - IPTV Management Panel v3.0.0 PRO

A full-featured IPTV streaming server management system with Xtream Codes v2.9 API compatibility. Built with Node.js, Express, React, PostgreSQL, and Drizzle ORM.

## Features

- **Multi-Server Architecture** - Load balancing and failover support
- **Reseller Management** - Credit-based system with tiered permissions
- **Live Streaming** - HLS/RTMP stream management with health monitoring
- **VOD & Series** - Movie and TV series catalog with metadata
- **EPG Integration** - XMLTV program guide support
- **Player API Compatibility** - Works with TiviMate, IPTV Smarters, and more
- **Device Management** - MAG/Stalker Portal and Enigma2 device support
- **Security** - IP blocking, rate limiting, device locking, GeoIP restrictions

## Requirements

- Ubuntu 20.04, 22.04, or 24.04 LTS
- Minimum 1GB RAM (2GB recommended)
- 5GB available disk space
- Root access (sudo)

## Quick Installation

### One-Line Install

```bash
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git && cd PanelX-V3.0.0-PRO && sudo bash install.sh
```

### Step-by-Step Installation

1. **Download PanelX**
```bash
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git
cd PanelX-V3.0.0-PRO
```

2. **Run the Installer**
```bash
sudo bash install.sh
```

3. **Follow the Installation Wizard**
   - Enter installation directory (default: `/opt/panelx`)
   - Enter web server port (default: `5000`)
   - Create admin username and password
   - Confirm and wait for installation to complete

4. **Access Your Panel**
   - Open your browser to `http://YOUR_SERVER_IP:5000`
   - Login with the admin credentials you created

## Installation Wizard

The installer will guide you through:

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ██████╗  █████╗ ███╗   ██╗███████╗██╗     ██╗  ██╗        ║
║     ██╔══██╗██╔══██╗████╗  ██║██╔════╝██║     ╚██╗██╔╝        ║
║     ██████╔╝███████║██╔██╗ ██║█████╗  ██║      ╚███╔╝         ║
║     ██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║      ██╔██╗         ║
║     ██║     ██║  ██║██║ ╚████║███████╗███████╗██╔╝ ╚██╗       ║
║     ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝   ╚═╝       ║
║                                                               ║
║           IPTV Management Panel - Installer v3.0.0            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Installation directory [/opt/panelx]: 
Web server port [5000]: 

Admin Account Setup
─────────────────────────────────────────────────
Admin username: admin
Admin password: ********
Confirm password: ********
```

## Service Management

After installation, PanelX runs as a systemd service:

```bash
# Start PanelX
sudo systemctl start panelx

# Stop PanelX
sudo systemctl stop panelx

# Restart PanelX
sudo systemctl restart panelx

# Check Status
sudo systemctl status panelx

# View Logs
sudo journalctl -u panelx -f
```

## Admin User Management

Use the admin management script to add, edit, or delete users:

```bash
sudo bash /opt/panelx/manage-admin.sh
```

### Available Options:
1. **List all users** - Display all admin and reseller accounts
2. **Add new user** - Create admin or reseller with secure password
3. **Change user password** - Update any user's credentials
4. **Delete user** - Remove user accounts

## Uninstallation

To completely remove PanelX:

```bash
sudo bash /opt/panelx/uninstall.sh
```

The uninstaller will:
- Stop the PanelX service
- Remove systemd service configuration
- Optionally remove the database (with confirmation)
- Clean up all application files
- Remove firewall rules

## Player API Endpoints

PanelX provides Xtream Codes compatible APIs:

| Endpoint | Description |
|----------|-------------|
| `/player_api.php` | Main authentication and content listing |
| `/get.php` | M3U/M3U8 playlist generation |
| `/live/:user/:pass/:id.:ext` | Live stream proxy |
| `/movie/:user/:pass/:id.:ext` | VOD stream proxy |
| `/series/:user/:pass/:id.:ext` | Series episode proxy |
| `/xmltv.php` | XMLTV EPG guide |
| `/stalker_portal/c/` | MAG device portal |

## Configuration

Configuration file: `/opt/panelx/.env`

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/panelx
SESSION_SECRET=your-secret-key
PORT=5000
NODE_ENV=production
```

## Troubleshooting

### Cannot access the panel
1. Check if the service is running: `sudo systemctl status panelx`
2. Check firewall: `sudo ufw status`
3. View logs: `sudo journalctl -u panelx -f`

### Database connection issues
1. Check PostgreSQL: `sudo systemctl status postgresql`
2. Verify DATABASE_URL in `/opt/panelx/.env`

### Forgot admin password
```bash
sudo bash /opt/panelx/manage-admin.sh
# Select option 3 to change password
```

## Support

For issues and feature requests, please open an issue on GitHub.

## License

This project is proprietary software. All rights reserved.
