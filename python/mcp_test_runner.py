class TestRunnerTool(MCPTool):
    name = "run_tests"
    description = "Runs unit tests on code."
    parameters = {"code": {"type": "string"}, "test": {"type": "string"}}
    def execute(self, params):
        code = params["code"]
        test = params["test"]
        with open("temp.py", "w") as f:
            f.write(code + "\n" + test)
        result = subprocess.run(["python", "temp.py"], capture_output=True, text=True)
        return "Pass" if not result.stderr else result.stderr
run_server([TestRunnerTool()])