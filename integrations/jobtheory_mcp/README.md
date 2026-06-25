# JobTheory MCP Skill

This directory contains the Model Context Protocol (MCP) server for Tayari. It allows local LLM agents (e.g. Cursor, Claude Desktop, local scripts) to securely search jobs, research salaries, check ATS compatibility, and manage the Kanban board directly on your behalf.

## Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Retrieve Auth Token**:
   - Log in to your Tayari frontend.
   - Open Developer Tools -> Application -> Local Storage.
   - Copy the value of `auth_token`.

3. **Configure Environment Variables**:
   ```bash
   export JOBTHEORY_URL="http://localhost:8080"
   export JOBTHEORY_TOKEN="<your_auth_token>"
   ```

4. **Start the MCP Server**:
   ```bash
   python server.py
   ```

## Registering with Claude Desktop

Add this to your Claude Desktop config (usually at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "jobtheory": {
      "command": "python",
      "args": ["/absolute/path/to/tayari-skill-boost/integrations/jobtheory_mcp/server.py"],
      "env": {
        "JOBTHEORY_URL": "http://localhost:8080",
        "JOBTHEORY_TOKEN": "<your_auth_token>"
      }
    }
  }
}
```
