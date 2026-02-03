#!/bin/bash
set -e

# Financial Skills Deployment Script
# Installs financial-data MCP server and financial-research skills to opencode/claude

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
MCP_NAME="financial-data"
MCP_SOURCE_DIR="$PROJECT_ROOT/financial-data-mcp"
SKILL_NAME="financial-research"
SKILL_SOURCE_DIR="$PROJECT_ROOT/skills/financial-research"

# Track which CLIs were deployed to
DEPLOYED_CLIS=()

# API Keys
FINNHUB_API_KEY="${FINNHUB_API_KEY:-}"
ALPHAVANTAGE_API_KEY="${ALPHAVANTAGE_API_KEY:-}"
TWELVEDATA_API_KEY="${TWELVEDATA_API_KEY:-}"
TIINGO_API_KEY="${TIINGO_API_KEY:-}"
LOG_LEVEL="${LOG_LEVEL:-}"

echo -e "${CYAN}${BOLD}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Financial Skills Deployment                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Function to print colored messages
print_info() { echo -e "${BLUE}ℹ $1${NC}" >&2; }
print_success() { echo -e "${GREEN}✓ $1${NC}" >&2; }
print_error() { echo -e "${RED}✗ $1${NC}" >&2; }
print_step() { echo -e "${BOLD}$1${NC}" >&2; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}" >&2; }

# Check dependencies
check_dependencies() {
    print_step "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "  Install from: https://nodejs.org/"
        exit 1
    fi
    print_success "node installed"

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        echo "  npm is usually included with Node.js"
        exit 1
    fi
    print_success "npm installed"
    echo ""
}

# Build MCP server
build_mcp() {
    print_step "Building MCP server..."
    cd "$MCP_SOURCE_DIR"

    # Install dependencies
    print_info "Installing dependencies..."
    npm install > /dev/null 2>&1

    # Build (don't fail on error)
    print_info "Compiling TypeScript..."
    if npm run build > /dev/null 2>&1; then
        print_success "MCP built successfully"
    else
        print_warning "Build had warnings/errors, continuing with existing dist if available"
    fi

    # Verify dist exists
    if [ ! -f "dist/server.js" ]; then
        print_error "dist/server.js not found. Please fix build errors."
        exit 1
    fi

    echo ""
}

# Select CLIs to deploy to
select_clis() {
    print_step "Select AI CLIs for deployment"
    echo ""

    local available_clis=()

    if command -v opencode &> /dev/null; then
        available_clis+=("opencode")
        print_info "[1] opencode (OpenCode)"
    fi

    if command -v claude &> /dev/null; then
        available_clis+=("claude")
        local claude_idx=${#available_clis[@]}
        print_info "[$claude_idx] claude (Claude Code)"
    fi

    if [ ${#available_clis[@]} -eq 0 ]; then
        print_error "No AI CLI found"
        echo "  Install opencode: https://opencode.ai/"
        echo "  Install claude: https://claude.ai/download"
        exit 1
    fi

    local all_idx=$((${#available_clis[@]} + 1))
    print_info "[$all_idx] all (Deploy to all available CLIs)"
    echo ""

    local selection
    echo -n "Enter choice (1-$all_idx): "
    read -r selection

    case "$selection" in
        "$all_idx"|all|All|ALL)
            DEPLOYED_CLIS=("${available_clis[@]}")
            ;;
        1)
            if [ ${#available_clis[@]} -ge 1 ]; then
                DEPLOYED_CLIS+=("${available_clis[0]}")
            fi
            ;;
        2)
            if [ ${#available_clis[@]} -ge 2 ]; then
                DEPLOYED_CLIS+=("${available_clis[1]}")
            fi
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac

    if [ ${#DEPLOYED_CLIS[@]} -eq 0 ]; then
        print_error "No valid CLI selected"
        exit 1
    fi

    echo ""
    print_success "Selected: ${DEPLOYED_CLIS[*]}"
    echo ""
}

# Check if MCP is already installed and ask what to do
check_existing_installation() {
    local cli="$1"
    local target_dir="$2"

    if [ -d "$target_dir" ]; then
        echo ""
        print_warning "MCP already installed at: $target_dir"
        echo "What would you like to do?"
        echo "  [1] Reinstall (remove existing and install fresh)"
        echo "  [2] Skip (keep existing installation)"
        echo ""
        echo -n "Enter choice (1-2): "
        read -r choice

        case "$choice" in
            1|"1"|"r"|"reinstall")
                return 0  # Proceed with installation
                ;;
            2|"2"|"s"|"skip")
                return 1  # Skip installation
                ;;
            *)
                print_error "Invalid choice, skipping installation"
                return 1
                ;;
        esac
    fi
    return 0  # Not installed, proceed
}

# Collect keys in a loop (one at a time)
collect_keys_loop() {
    local prompt_text="$1"
    local keys=()

    while true; do
        if [ ${#keys[@]} -eq 0 ]; then
            echo -n "$prompt_text (optional, press Enter to skip): " >&2
        else
            echo "--- Key #${#keys[@]} added. Enter another or press Enter to finish ---" >&2
            echo -n "Next key: " >&2
        fi
        read -r key

        # Empty input means we're done
        if [ -z "$key" ]; then
            break
        fi

        keys+=("$key")
    done

    # Join keys with commas
    local result=""
    for i in "${!keys[@]}"; do
        if [ $i -gt 0 ]; then
            result="$result,"
        fi
        result="$result${keys[$i]}"
    done

    echo "$result"
}

collect_log_level() {
    print_step "Configuring Log Level..."
    echo "" >&2
    echo "Available levels:" >&2
    echo "  [1] INFO  (Default - standard logging)" >&2
    echo "  [2] DEBUG (Detailed logging for troubleshooting)" >&2
    echo "  [3] WARN  (Warnings and errors only)" >&2
    echo "  [4] ERROR (Errors only)" >&2
    echo "" >&2
    echo -n "Enter choice (1-4) or press Enter for INFO: " >&2
    read -r choice

    case "$choice" in
        2|DEBUG|debug)
            echo "DEBUG"
            ;;
        3|WARN|warn)
            echo "WARN"
            ;;
        4|ERROR|error)
            echo "ERROR"
            ;;
        *)
            echo "INFO"
            ;;
    esac
}

collect_api_keys() {
    print_step "Configuring API keys..."
    echo ""
    print_info "Get free API keys:"
    echo "  • Finnhub: https://finnhub.io/register" >&2
    echo "  • Alpha Vantage: https://www.alphavantage.co/support/#api-key" >&2
    echo "  • TwelveData: https://twelvedata.com/pricing" >&2
    echo "  • Tiingo: https://www.tiingo.com/account/api/token" >&2
    echo ""
    print_warning "API keys are optional. You can configure them later in your CLI config."
    echo ""

    # Use environment variables if available
    if [ -z "$FINNHUB_API_KEY" ]; then
        echo ""
        echo "You can enter multiple API keys for rotation." >&2
        echo "Enter each key one at a time, press Enter without input to finish." >&2
        echo ""
        print_info "Now entering: FINNHUB_API_KEY"
        FINNHUB_API_KEY=$(collect_keys_loop "Enter FINNHUB_API_KEY")
    fi

    if [ -z "$ALPHAVANTAGE_API_KEY" ]; then
        echo ""
        echo "You can enter multiple API keys for rotation." >&2
        echo "Enter each key one at a time, press Enter without input to finish." >&2
        echo ""
        print_info "Now entering: ALPHAVANTAGE_API_KEY"
        ALPHAVANTAGE_API_KEY=$(collect_keys_loop "Enter ALPHAVANTAGE_API_KEY")
    fi

    if [ -z "$TWELVEDATA_API_KEY" ]; then
        echo ""
        echo "You can enter multiple API keys for rotation." >&2
        echo "Enter each key one at a time, press Enter without input to finish." >&2
        echo ""
        print_info "Now entering: TWELVEDATA_API_KEY"
        TWELVEDATA_API_KEY=$(collect_keys_loop "Enter TWELVEDATA_API_KEY")
    fi

    if [ -z "$TIINGO_API_KEY" ]; then
        echo ""
        echo "You can enter multiple API keys for rotation." >&2
        echo "Enter each key one at a time, press Enter without input to finish." >&2
        echo ""
        print_info "Now entering: TIINGO_API_KEY"
        TIINGO_API_KEY=$(collect_keys_loop "Enter TIINGO_API_KEY")
    fi

    if [ -z "$LOG_LEVEL" ]; then
        echo ""
        LOG_LEVEL=$(collect_log_level)
        print_success "Log Level set to $LOG_LEVEL"
    fi

    # Export for use in deploy functions
    export FINNHUB_API_KEY
    export ALPHAVANTAGE_API_KEY
    export TWELVEDATA_API_KEY
    export TIINGO_API_KEY
    export LOG_LEVEL

    # Show configuration summary
    echo ""
    local configured=false
    if [ -n "$FINNHUB_API_KEY" ]; then
        # Count keys by splitting on comma
        local key_count=$(echo "$FINNHUB_API_KEY" | tr ',' '\n' | grep -v '^$' | wc -l)
        if [ "$key_count" -gt 1 ]; then
            print_success "Finnhub: $key_count API keys configured for rotation"
        else
            print_success "Finnhub API key configured"
        fi
        configured=true
    fi
    if [ -n "$ALPHAVANTAGE_API_KEY" ]; then
        # Count keys by splitting on comma
        local key_count=$(echo "$ALPHAVANTAGE_API_KEY" | tr ',' '\n' | grep -v '^$' | wc -l)
        if [ "$key_count" -gt 1 ]; then
            print_success "Alpha Vantage: $key_count API keys configured for rotation"
        else
            print_success "Alpha Vantage API key configured"
        fi
        configured=true
    fi
    if [ -n "$TWELVEDATA_API_KEY" ]; then
        local key_count=$(echo "$TWELVEDATA_API_KEY" | tr ',' '\n' | grep -v '^$' | wc -l)
        if [ "$key_count" -gt 1 ]; then
            print_success "TwelveData: $key_count API keys configured for rotation"
        else
            print_success "TwelveData API key configured"
        fi
        configured=true
    fi
    if [ -n "$TIINGO_API_KEY" ]; then
        local key_count=$(echo "$TIINGO_API_KEY" | tr ',' '\n' | grep -v '^$' | wc -l)
        if [ "$key_count" -gt 1 ]; then
            print_success "Tiingo: $key_count API keys configured for rotation"
        else
            print_success "Tiingo API key configured"
        fi
        configured=true
    fi
    
    if [ "$configured" = false ]; then
        print_warning "No API keys configured - add them later in your CLI config"
    fi
    echo ""
}

# Deploy to opencode
deploy_to_opencode() {
    print_step "Deploying to opencode..."

    local target_dir="$HOME/.opencode/mcp-servers/$MCP_NAME"
    local skills_dir="$HOME/.opencode/skills/$SKILL_NAME"
    local config_file="$HOME/.config/opencode/opencode.json"

    # Check if already installed
    if ! check_existing_installation "opencode" "$target_dir"; then
        print_info "Skipping opencode deployment (existing installation kept)"
        echo ""
        return
    fi

    # Copy only dist and package.json
    print_info "Installing MCP server..."
    rm -rf "$target_dir"
    mkdir -p "$target_dir"

    # Copy dist directory
    if [ -d "$MCP_SOURCE_DIR/dist" ]; then
        cp -r "$MCP_SOURCE_DIR/dist" "$target_dir/"
        print_success "MCP dist copied"
    else
        print_error "dist directory not found in $MCP_SOURCE_DIR"
        exit 1
    fi

    # Copy package.json for dependencies
    if [ -f "$MCP_SOURCE_DIR/package.json" ]; then
        cp "$MCP_SOURCE_DIR/package.json" "$target_dir/"
    fi

    # Install dependencies in target directory (production only)
    print_info "Installing dependencies..."
    (cd "$target_dir" && npm install --production > /dev/null 2>&1)

    if [ ! -f "$target_dir/dist/server.js" ]; then
        print_error "dist/server.js not found after installation"
        exit 1
    fi

    print_success "MCP installed"

    # Register MCP using jq (opencode mcp add is interactive)
    register_mcp_opencode "$config_file" "$target_dir/dist/server.js"

    # Copy skills
    print_info "Installing skills..."
    rm -rf "$skills_dir"
    mkdir -p "$(dirname "$skills_dir")"
    cp -r "$SKILL_SOURCE_DIR" "$skills_dir"
    print_success "Skills installed to $skills_dir"

    echo ""
}

# Deploy to claude
deploy_to_claude() {
    print_step "Deploying to claude..."

    local target_dir="$HOME/.claude/mcp-servers/$MCP_NAME"
    local skills_dir="$HOME/.claude/skills/$SKILL_NAME"

    # Check if already installed
    if ! check_existing_installation "claude" "$target_dir"; then
        print_info "Skipping claude deployment (existing installation kept)"
        echo ""
        return
    fi

    # Copy only dist and package.json
    print_info "Installing MCP server..."
    rm -rf "$target_dir"
    mkdir -p "$target_dir"

    # Copy dist directory
    if [ -d "$MCP_SOURCE_DIR/dist" ]; then
        cp -r "$MCP_SOURCE_DIR/dist" "$target_dir/"
        print_success "MCP dist copied"
    else
        print_error "dist directory not found in $MCP_SOURCE_DIR"
        exit 1
    fi

    # Copy package.json for dependencies
    if [ -f "$MCP_SOURCE_DIR/package.json" ]; then
        cp "$MCP_SOURCE_DIR/package.json" "$target_dir/"
    fi

    # Install dependencies in target directory (production only)
    print_info "Installing dependencies..."
    (cd "$target_dir" && npm install --production > /dev/null 2>&1)

    if [ ! -f "$target_dir/dist/server.js" ]; then
        print_error "dist/server.js not found after installation"
        exit 1
    fi

    print_success "MCP installed"

    # Register MCP using claude mcp add command
    register_mcp_claude "$target_dir/dist/server.js"

    # Copy skills
    print_info "Installing skills..."
    rm -rf "$skills_dir"
    mkdir -p "$(dirname "$skills_dir")"
    cp -r "$SKILL_SOURCE_DIR" "$skills_dir"
    print_success "Skills installed to $skills_dir"

    echo ""
}

# Register MCP in opencode config (using jq since mcp add is interactive)
register_mcp_opencode() {
    local config_file="$1"
    local server_path="$2"

    print_info "Registering MCP server..."

    if [ ! -f "$config_file" ]; then
        print_info "Config file not found, skipping registration"
        return
    fi

    if ! command -v jq &> /dev/null; then
        print_info "jq not found - skipping config registration"
        return
    fi

    # Build jq filter dynamically - use full comma-separated keys
    local jq_filter='.mcp[$name] = { type: "local", command: ["node", $path], environment: {'

    local env_added=false
    if [ -n "$FINNHUB_API_KEY" ]; then
        jq_filter="$jq_filter FINNHUB_API_KEY: \$finnhub"
        env_added=true
    fi
    if [ -n "$ALPHAVANTAGE_API_KEY" ]; then
        if [ "$env_added" = true ]; then
            jq_filter="$jq_filter, ALPHAVANTAGE_API_KEY: \$alphavantage"
        else
            jq_filter="$jq_filter ALPHAVANTAGE_API_KEY: \$alphavantage"
        fi
        env_added=true
    fi
    if [ -n "$TWELVEDATA_API_KEY" ]; then
        if [ "$env_added" = true ]; then
            jq_filter="$jq_filter, TWELVEDATA_API_KEY: \$twelvedata"
        else
            jq_filter="$jq_filter TWELVEDATA_API_KEY: \$twelvedata"
        fi
        env_added=true
    fi
    if [ -n "$TIINGO_API_KEY" ]; then
        if [ "$env_added" = true ]; then
            jq_filter="$jq_filter, TIINGO_API_KEY: \$tiingo"
        else
            jq_filter="$jq_filter TIINGO_API_KEY: \$tiingo"
        fi
        env_added=true
    fi
    if [ -n "$LOG_LEVEL" ]; then
        if [ "$env_added" = true ]; then
            jq_filter="$jq_filter, LOG_LEVEL: \$loglevel"
        else
            jq_filter="$jq_filter LOG_LEVEL: \$loglevel"
        fi
        env_added=true
    fi

    jq_filter="$jq_filter } }"

    jq --arg name "$MCP_NAME" \
       --arg path "$server_path" \
       --arg finnhub "$FINNHUB_API_KEY" \
       --arg alphavantage "$ALPHAVANTAGE_API_KEY" \
       --arg twelvedata "$TWELVEDATA_API_KEY" \
       --arg tiingo "$TIINGO_API_KEY" \
       --arg loglevel "$LOG_LEVEL" \
       "$jq_filter" "$config_file" > "${config_file}.tmp" && mv "${config_file}.tmp" "$config_file"
    print_success "MCP registered in opencode config"
}

# Register MCP for claude using claude mcp add command
register_mcp_claude() {
    local server_path="$1"

    print_info "Registering MCP server..."

    # First, remove if exists to avoid conflicts
    if claude mcp get "$MCP_NAME" &> /dev/null; then
        print_info "Removing existing MCP server..."
        claude mcp remove "$MCP_NAME" &> /dev/null || true
    fi

    # Build command array
    local cmd=("claude" "mcp" "add" "$MCP_NAME")

    if [ -n "$FINNHUB_API_KEY" ]; then
        cmd+=("-e" "FINNHUB_API_KEY=$FINNHUB_API_KEY")
    fi
    if [ -n "$ALPHAVANTAGE_API_KEY" ]; then
        cmd+=("-e" "ALPHAVANTAGE_API_KEY=$ALPHAVANTAGE_API_KEY")
    fi
    if [ -n "$TWELVEDATA_API_KEY" ]; then
        cmd+=("-e" "TWELVEDATA_API_KEY=$TWELVEDATA_API_KEY")
    fi
    if [ -n "$TIINGO_API_KEY" ]; then
        cmd+=("-e" "TIINGO_API_KEY=$TIINGO_API_KEY")
    fi
    if [ -n "$LOG_LEVEL" ]; then
        cmd+=("-e" "LOG_LEVEL=$LOG_LEVEL")
    fi

    cmd+=("--" "node" "$server_path")

    # Execute the command
    "${cmd[@]}" &> /dev/null

    if [ $? -eq 0 ]; then
        print_success "MCP registered in claude config"
    else
        print_warning "Failed to register MCP via cli command"
    fi
}

# Show completion message
show_completion() {
    echo -e "${GREEN}${BOLD}Deployment Complete!${NC}"
    echo ""

    # Build IDE names for restart message
    local ide_names=()
    for cli in "${DEPLOYED_CLIS[@]}"; do
        case $cli in
            opencode) ide_names+=("OpenCode") ;;
            claude) ide_names+=("Claude Code") ;;
        esac
    done

    # Join with " / " if multiple, otherwise single
    local ide_list
    if [ ${#ide_names[@]} -eq 1 ]; then
        ide_list="${ide_names[0]}"
    else
        # Manually join with " / "
        ide_list="${ide_names[0]}"
        for ((i=1; i<${#ide_names[@]}; i++)); do
            ide_list="$ide_list / ${ide_names[$i]}"
        done
    fi

    echo "Restart your IDE ($ide_list) for changes to take effect."
    echo ""

    echo "Installed:"
    for cli in "${DEPLOYED_CLIS[@]}"; do
        case $cli in
            opencode)
                echo "  MCP:     ~/.opencode/mcp-servers/$MCP_NAME/"
                echo "  Skills:  ~/.opencode/skills/$SKILL_NAME/"
                ;;
            claude)
                echo "  MCP:     ~/.claude/mcp-servers/$MCP_NAME/"
                echo "  Skills:  ~/.claude/skills/$SKILL_NAME/"
                ;;
        esac
    done
    echo ""

    # Show API key reminder if no keys configured
    if [ -z "$FINNHUB_API_KEY" ] && [ -z "$ALPHAVANTAGE_API_KEY" ] && [ -z "$TWELVEDATA_API_KEY" ] && [ -z "$TIINGO_API_KEY" ]; then
        echo -e "${YELLOW}⚠ Don't forget to add your API keys!${NC}"
        echo ""
        echo "Get free API keys:"
        echo "  • Finnhub: https://finnhub.io/register"
        echo "  • Alpha Vantage: https://www.alphavantage.co/support/#api-key"
        echo "  • TwelveData: https://twelvedata.com/pricing"
        echo "  • Tiingo: https://www.tiingo.com/account/api/token"
        echo ""
        echo "Edit your CLI config to add environment variables:"
        for cli in "${DEPLOYED_CLIS[@]}"; do
            case $cli in
                opencode)
                    echo "  ~/.config/opencode/opencode.json"
                    ;;
                claude)
                    echo "  ~/.claude/settings.json"
                    ;;
            esac
        done | sort -u
        echo ""
    fi
}

# Main execution
main() {
    check_dependencies
    build_mcp
    select_clis
    collect_api_keys

    for cli in "${DEPLOYED_CLIS[@]}"; do
        case $cli in
            opencode) deploy_to_opencode ;;
            claude) deploy_to_claude ;;
        esac
    done

    show_completion
}

main "$@"
