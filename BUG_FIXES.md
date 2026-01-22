# PanelX Bug Fixes - Critical Issues Found During Testing

## Issues Identified

After fresh installation testing on Ubuntu 24, the following critical bugs were discovered:

### 1. ✅ Streams Don't Play in IPTV Players
**Status:** WORKING - No code changes needed
**Issue:** Sample data uses placeholder URLs that don't exist
**Solution:** Add real stream URLs through admin panel

Test stream provided: `http://eu4k.online:8080/live/panelx/panelx/280169.ts`

### 2. ❌ Create Line Form - Expiration Date Not Saving
**Status:** BUG CONFIRMED - Needs fix
**Root Cause:** Date input field is sending string format, but backend expects Date object or ISO string

**Current behavior:**
- User selects date in `<input type="datetime-local">`
- Form submits but date is not properly converted
- Line is created but `expDate` is null or incorrect

**Fix Required:** Convert datetime-local string to ISO Date format before submission

### 3. ❌ Reseller Dashboard Shows Blank Page  
**Status:** BUG CONFIRMED - Needs investigation
**Root Cause:** Likely missing API endpoint or authentication issue

**Component:** `/client/src/pages/ResellerDashboard.tsx`
**Expected:** Reseller-specific dashboard with stats and line management
**Actual:** Blank page (possible 404 or authentication error)

### 4. ❌ Add Server Form Missing SSH Credentials Fields
**Status:** ENHANCEMENT NEEDED
**Root Cause:** Schema only includes HTTP/RTMP ports, not SSH credentials

**Current fields:**
- Server Name
- Server URL  
- HTTP Port
- RTMP Port
- Max Clients

**Missing fields for load balancer functionality:**
- SSH Username (root)
- SSH Password
- SSH Port (22)
- SSH Private Key (optional)

**Purpose:** To enable remote server management for load balancing

### 5. ❓ Other Potential Issues (To Be Tested)
- Form validation not showing proper error messages
- Some dialogs not closing after submission
- Bulk operations may not refresh UI

---

## Detailed Fixes

### Fix #1: Create Line - Expiration Date Conversion

**File:** `client/src/pages/Lines.tsx`

**Current Issue:**
```typescript
<Input 
  id="expDate" 
  type="datetime-local" 
  {...form.register("expDate")}
  data-testid="input-exp-date"
/>
```

The `datetime-local` input returns a string like `"2026-01-30T15:00"` but the backend expects a Date object or ISO string with timezone.

**Solution:**

```typescript
// In the handleFormSubmit function, convert the date:
const handleFormSubmit = (data: InsertLine) => {
  const formData = {
    ...data,
    // Convert datetime-local string to Date object
    expDate: data.expDate ? new Date(data.expDate) : undefined,
    bouquets: selectedBouquets,
    allowedIps: allowedIpsText.split(',').map(s => s.trim()).filter(Boolean),
    allowedCountries: allowedCountriesText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
    allowedUserAgents: allowedUserAgentsText.split('\n').map(s => s.trim()).filter(Boolean),
  };
  onSubmit(formData);
};
```

**Alternative Solution (Better UX):**
Use a proper date picker component instead of native datetime-local:

```typescript
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

// In the form:
<div className="space-y-2">
  <Label>Expiration Date</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="w-full justify-start text-left font-normal">
        <CalendarIcon className="mr-2 h-4 w-4" />
        {form.watch("expDate") ? format(new Date(form.watch("expDate")), "PPP") : "Select date"}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0">
      <Calendar
        mode="single"
        selected={form.watch("expDate") ? new Date(form.watch("expDate")) : undefined}
        onSelect={(date) => form.setValue("expDate", date)}
        initialFocus
      />
    </PopoverContent>
  </Popover>
</div>
```

---

### Fix #2: Reseller Dashboard Blank Page

**File:** `client/src/pages/ResellerDashboard.tsx`

**Investigation Steps:**

1. Check if route is properly defined in App.tsx
2. Check if API endpoint `/api/reseller/*` exists in server/routes.ts
3. Check authentication/authorization for reseller role
4. Check browser console for errors

**Likely Issues:**

A) **Missing Route:** Route is not defined or not accessible

**Check App.tsx:**
```typescript
// Should have reseller route
<Route path="/reseller-dashboard" component={ResellerDashboard} />
```

B) **Missing API Endpoint:** Backend route doesn't exist

**Check server/routes.ts:**
```bash
grep -n "/api/reseller" server/routes.ts
```

If missing, need to add reseller-specific endpoints:
```typescript
// Reseller dashboard stats
app.get("/api/reseller/stats", requireReseller, async (req, res) => {
  const userId = req.session!.userId;
  // Get stats for this reseller
  const lines = await storage.getLines(); // Filter by memberId
  const myLines = lines.filter(l => l.memberId === userId);
  
  res.json({
    totalLines: myLines.length,
    activeLines: myLines.filter(l => l.enabled).length,
    expiredLines: myLines.filter(l => l.expDate && new Date(l.expDate) < new Date()).length,
    credits: (await storage.getUser(userId))?.credits || 0
  });
});

// Reseller's lines
app.get("/api/reseller/lines", requireReseller, async (req, res) => {
  const userId = req.session!.userId;
  const lines = await storage.getLines();
  const myLines = lines.filter(l => l.memberId === userId);
  res.json(myLines);
});
```

C) **Wrong Role Check:** User is logged in as admin, not reseller

**Check:** Login with reseller1 / reseller123 (from sample data)

---

### Fix #3: Add Server Form - SSH Credentials

**Files to Modify:**
- `shared/schema.ts` - Add SSH fields to servers table
- `client/src/pages/Servers.tsx` - Add input fields  
- `server/storage.ts` - Handle new fields in CRUD operations

**Step 1: Update Database Schema**

**File:** `shared/schema.ts`

```typescript
export const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  serverName: text("server_name").notNull(),
  serverUrl: text("server_url").notNull(),
  serverPort: integer("server_port").default(80),
  rtmpPort: integer("rtmp_port").default(1935),
  httpBroadcastPort: integer("http_broadcast_port").default(25461),
  isMainServer: boolean("is_main_server").default(false),
  
  // SSH Access for Load Balancing
  sshHost: text("ssh_host"), // IP or hostname for SSH
  sshPort: integer("ssh_port").default(22),
  sshUsername: text("ssh_username").default("root"),
  sshPassword: text("ssh_password"), // Encrypted in production
  sshPrivateKey: text("ssh_private_key"), // Alternative to password
  
  status: text("status").default("offline"),
  maxClients: integer("max_clients").default(1000),
  currentClients: integer("current_clients").default(0),
  cpuUsage: real("cpu_usage").default(0),
  memoryUsage: real("memory_usage").default(0),
  bandwidth: real("bandwidth").default(0),
  lastChecked: timestamp("last_checked"),
  enabled: boolean("enabled").default(true),
  geoZone: text("geo_zone"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Step 2: Update InsertServer Schema**

```typescript
export const insertServerSchema = createInsertSchema(servers).omit({
  id: true,
  createdAt: true,
  currentClients: true,
  cpuUsage: true,
  memoryUsage: true,
  bandwidth: true,
  lastChecked: true,
});
```

**Step 3: Add Fields to Server Form**

**File:** `client/src/pages/Servers.tsx`

Add after existing fields:

```typescript
<div className="space-y-4 border-t pt-4">
  <h4 className="font-semibold">SSH Access (for Load Balancing)</h4>
  
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="sshHost">SSH Host</Label>
      <Input 
        id="sshHost" 
        {...form.register("sshHost")} 
        placeholder="192.168.1.100"
      />
      <p className="text-xs text-muted-foreground">IP address or hostname for SSH connection</p>
    </div>
    <div className="space-y-2">
      <Label htmlFor="sshPort">SSH Port</Label>
      <Input 
        id="sshPort" 
        type="number" 
        {...form.register("sshPort", { valueAsNumber: true })} 
        defaultValue={22}
      />
    </div>
  </div>

  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="sshUsername">SSH Username</Label>
      <Input 
        id="sshUsername" 
        {...form.register("sshUsername")} 
        defaultValue="root"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="sshPassword">SSH Password</Label>
      <Input 
        id="sshPassword" 
        type="password" 
        {...form.register("sshPassword")} 
        placeholder="(optional if using key)"
      />
    </div>
  </div>

  <div className="space-y-2">
    <Label htmlFor="sshPrivateKey">SSH Private Key (Optional)</Label>
    <Textarea 
      id="sshPrivateKey" 
      {...form.register("sshPrivateKey")} 
      placeholder="-----BEGIN RSA PRIVATE KEY-----"
      rows={4}
    />
    <p className="text-xs text-muted-foreground">Paste private key for key-based authentication</p>
  </div>
</div>
```

**Step 4: Run Database Migration**

```bash
cd /opt/panelx
npm run db:push
sudo systemctl restart panelx
```

---

## Testing Checklist After Fixes

### Test Create Line with Expiration Date
1. Login to admin panel
2. Go to Lines
3. Click "Create Line"
4. Fill all fields including expiration date
5. Click "Create Line"
6. ✅ Verify line is created
7. ✅ Verify expiration date is saved correctly
8. ✅ Check database: `SELECT username, exp_date FROM lines ORDER BY id DESC LIMIT 1;`

### Test Reseller Dashboard
1. Logout from admin
2. Login as reseller (reseller1 / reseller123)
3. Navigate to reseller dashboard
4. ✅ Page should load without errors
5. ✅ Should show reseller stats
6. ✅ Should show reseller's lines only
7. ✅ Should be able to create lines

### Test Add Server with SSH
1. Login as admin
2. Go to Servers
3. Click "Add Server"
4. Fill all fields including SSH credentials
5. Click "Create"
6. ✅ Server should be created
7. ✅ SSH fields should be saved
8. ✅ Check database: `SELECT server_name, ssh_host, ssh_username FROM servers ORDER BY id DESC LIMIT 1;`

### Test Stream Playback
1. Add a real stream via admin panel:
   - Name: Test Stream
   - Type: live
   - URL: `http://eu4k.online:8080/live/panelx/panelx/280169.ts`
   - Category: Sports
2. Assign stream to a bouquet
3. Assign bouquet to testuser1
4. Test in IPTV player (TiviMate):
   - Server: http://YOUR_IP:5000
   - Username: testuser1
   - Password: test123
5. ✅ Stream should appear in channel list
6. ✅ Stream should play when selected

---

## Priority Order

1. **HIGH** - Fix Create Line expiration date (affects line creation)
2. **HIGH** - Fix Reseller Dashboard (completely broken)
3. **MEDIUM** - Add SSH fields to servers (enhancement for load balancing)
4. **LOW** - Other UI improvements

---

## Implementation Plan

1. Fix expiration date conversion in Lines.tsx
2. Investigate and fix Reseller Dashboard
3. Add SSH fields to database schema
4. Update server form with SSH inputs
5. Test all fixes thoroughly
6. Push to GitHub
7. Deploy to production server

---

## Notes

- All fixes should be tested locally first
- Database migrations should be run after schema changes
- Backup database before major changes: `pg_dump panelx > backup.sql`
- Test with real IPTV players after fixes
- Update documentation after changes

---

## SQL Debugging Queries

```sql
-- Check if lines have expiration dates
SELECT id, username, exp_date, created_at FROM lines ORDER BY id DESC LIMIT 10;

-- Check server configuration
SELECT id, server_name, ssh_host, ssh_username FROM servers;

-- Check user roles
SELECT id, username, role, credits FROM users;

-- Check which bouquets are assigned to lines
SELECT l.username, b.bouquet_name 
FROM lines l 
LEFT JOIN bouquets b ON b.id = ANY(l.bouquets);
```

