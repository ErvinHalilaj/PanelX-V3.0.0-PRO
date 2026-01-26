#!/bin/bash

# Validate all package versions in package.json

echo "🔍 Validating all package versions in package.json..."
echo ""

ERRORS=0

# Extract all dependencies
DEPS=$(cat package.json | jq -r '.dependencies, .devDependencies | to_entries[] | "\(.key)@\(.value)"' | sed 's/@\^/@/g' | sed 's/@~/@/g')

for dep in $DEPS; do
    PKG=$(echo $dep | cut -d'@' -f1)
    VER=$(echo $dep | cut -d'@' -f2)
    
    # Skip if version is a wildcard or range
    if [[ "$VER" == "*" ]] || [[ "$VER" == "latest" ]]; then
        continue
    fi
    
    # Check if version exists
    if npm view "${PKG}@${VER}" version > /dev/null 2>&1; then
        echo "✅ $PKG@$VER"
    else
        echo "❌ $PKG@$VER - VERSION NOT FOUND!"
        ERRORS=$((ERRORS + 1))
        
        # Get latest version
        LATEST=$(npm view $PKG version 2>/dev/null)
        if [ ! -z "$LATEST" ]; then
            echo "   💡 Latest available: $LATEST"
        fi
    fi
done

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All package versions are valid!"
    exit 0
else
    echo "❌ Found $ERRORS invalid package versions!"
    exit 1
fi
