"""
AlgoStudio Code Runner Engine
Executes user code against structured test cases in an isolated Python subprocess.
"""

import sys
import json
import time
import subprocess


def execute_python_code(code: str, test_cases: list, definition: dict = None, timeout: int = 8) -> dict:
    definition = definition or {}
    class_name = definition.get("className", "Solution")
    default_method = ""
    if definition.get("methods"):
        default_method = definition["methods"][0].get("name", "")

    tc_json_str = json.dumps(json.dumps(test_cases))
    harness = f"""
import sys, json, time

# User Code
{code}

# Test Harness
def run_tests():
    sol_cls = globals().get('{class_name}')
    if not sol_cls:
        print("RUNNER_RESULT_START")
        print(json.dumps({{'error': "Class '{class_name}' not defined in solution", 'results': []}}))
        print("RUNNER_RESULT_END")
        return

    try:
        sol = sol_cls()
    except Exception as e:
        print("RUNNER_RESULT_START")
        print(json.dumps({{'error': f"Failed to instantiate '{class_name}': {{e}}", 'results': []}}))
        print("RUNNER_RESULT_END")
        return

    test_cases = json.loads({tc_json_str})
    results = []
    
    start_all = time.time()
    for idx, tc in enumerate(test_cases):
        steps = tc.get('steps', [])
        if not steps:
            continue
        step = steps[0]
        m_name = step.get('methodName') or '{default_method}'
        args = step.get('input', [])
        expected = step.get('expectedReturn') if 'expectedReturn' in step else step.get('expected')
        
        fn = getattr(sol, m_name, None)
        if not fn:
            results.append({{
                'case': idx + 1,
                'passed': False,
                'error': f"Method '{{m_name}}' not found on '{class_name}'",
                'input': args,
                'expected': expected,
                'actual': None
            }})
            continue
            
        t0 = time.time()
        try:
            actual = fn(*args)
            duration_ms = round((time.time() - t0) * 1000, 2)
            passed = (actual == expected)
            results.append({{
                'case': idx + 1,
                'passed': passed,
                'durationMs': duration_ms,
                'input': args,
                'expected': expected,
                'actual': actual
            }})
        except Exception as e:
            results.append({{
                'case': idx + 1,
                'passed': False,
                'error': str(e),
                'input': args,
                'expected': expected,
                'actual': None
            }})
            
    total_time_ms = round((time.time() - start_all) * 1000, 2)
    passed_count = sum(1 for r in results if r.get('passed'))
    
    print("RUNNER_RESULT_START")
    print(json.dumps({{
        'passed': passed_count,
        'total': len(results),
        'allPassed': (passed_count == len(results) and len(results) > 0),
        'totalTimeMs': total_time_ms,
        'results': results
    }}))
    print("RUNNER_RESULT_END")

if __name__ == '__main__':
    run_tests()
"""
    try:
        proc = subprocess.run(
            [sys.executable, "-c", harness],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        stdout = proc.stdout
        stderr = proc.stderr

        if "RUNNER_RESULT_START" in stdout:
            start = stdout.find("RUNNER_RESULT_START") + len("RUNNER_RESULT_START")
            end = stdout.find("RUNNER_RESULT_END")
            result_json = stdout[start:end].strip()
            data = json.loads(result_json)
            data["stdout"] = stdout[:stdout.find("RUNNER_RESULT_START")].strip()
            return data
        else:
            return {
                "error": stderr.strip() or stdout.strip() or "Process terminated without structured output",
                "passed": 0,
                "total": len(test_cases),
                "allPassed": False,
                "results": []
            }
    except subprocess.TimeoutExpired:
        return {
            "error": f"Time Limit Exceeded (>{timeout}s)",
            "passed": 0,
            "total": len(test_cases),
            "allPassed": False,
            "results": []
        }
    except Exception as e:
        return {
            "error": str(e),
            "passed": 0,
            "total": len(test_cases),
            "allPassed": False,
            "results": []
        }
