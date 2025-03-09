from mcp import MCPTool
import subprocess
class LinterTool(MCPTool):
    name = "run_linter"
    description = "Checks code for syntax/style errors."
    parameters = {"code": {"type": "string"}}
    def execute(self, params):
        code = params["code"]
        with open("temp.py", "w") as f:
            f.write(code)
        result = subprocess.run(["flake8", "temp.py"], capture_output=True, text=True)
        return "OK" if not result.stdout else result.stdout
run_server([LinterTool()])