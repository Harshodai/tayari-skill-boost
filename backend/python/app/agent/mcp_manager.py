import json
import asyncio
from typing import Dict, Any, List, Optional, Callable

class MCPTool:
    """Represents an internal tool used by the Python agent runtime.

    This registry is intentionally not an external MCP server. Public MCP
    discovery and execution are owned by the authenticated Supabase function;
    keeping that boundary explicit prevents this compatibility registry from
    becoming a shadow tool surface.
    """
    def __init__(self, name: str, description: str, input_schema: Dict[str, Any], handler: Callable, public: bool = False):
        self.name = name
        self.description = description
        self.input_schema = input_schema
        self.handler = handler
        self.public = public

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
            "internalOnly": not self.public,
        }

class MCPManager:
    """
    Model Context Protocol (MCP) Manager.
    Implements Anthropic's open standard for tool discovery and execution.
    Exposes unified JSON-RPC 2.0 interface for registering tools, resources, and prompts.
    """

    def __init__(self):
        self.tools: Dict[str, MCPTool] = {}
        self.resources: Dict[str, Dict[str, Any]] = {}
        self.prompts: Dict[str, Dict[str, Any]] = {}

    def register_tool(self, name: str, description: str, input_schema: Dict[str, Any], handler: Callable, *, public: bool = False):
        """Register an internal compatibility tool; public exposure is opt-in and currently unused."""
        tool = MCPTool(name=name, description=description, input_schema=input_schema, handler=handler, public=public)
        self.tools[name] = tool

    def register_resource(self, uri: str, name: str, mime_type: str, content: str):
        """Register an MCP resource."""
        self.resources[uri] = {
            "uri": uri,
            "name": name,
            "mimeType": mime_type,
            "text": content
        }

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all tools registered in the MCP host."""
        return [tool.to_dict() for tool in self.tools.values()]

    def list_resources(self) -> List[Dict[str, Any]]:
        """List all resources registered in the internal agent runtime."""
        return list(self.resources.values())

    def list_public_tools(self) -> List[Dict[str, Any]]:
        """Return only tools explicitly approved for an external surface."""
        return [tool.to_dict() for tool in self.tools.values() if tool.public]

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool call by name with JSON-RPC standard error handling."""
        if name not in self.tools:
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Error: MCP Tool '{name}' not found."}]
            }

        tool = self.tools[name]
        try:
            if asyncio.iscoroutinefunction(tool.handler):
                result = await tool.handler(**arguments)
            else:
                result = tool.handler(**arguments)

            content_text = json.dumps(result) if isinstance(result, (dict, list)) else str(result)
            return {
                "isError": False,
                "content": [{"type": "text", "text": content_text}]
            }
        except Exception as e:
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Execution Error in tool '{name}': {str(e)}"}]
            }
