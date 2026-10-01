"""
AlgoStudio Python Language Server (LSP) Engine
Provides autocomplete (Jedi), hover docs, real-time AST linting, and formatting (Black).
"""

import ast

try:
    import jedi
except ImportError:
    jedi = None

try:
    import black
except ImportError:
    black = None


def complete(code: str, line: int, column: int) -> dict:
    if not jedi or not code:
        return {"suggestions": []}

    try:
        script = jedi.Script(code)
        comps = script.complete(line, column)
        kind_map = {
            "module": 8,
            "class": 6,
            "instance": 5,
            "function": 2,
            "param": 5,
            "path": 16,
            "keyword": 13,
            "property": 9,
            "statement": 5
        }
        results = []
        for c in comps[:40]:
            doc = c.docstring()
            results.append({
                "label": c.name,
                "kind": kind_map.get(c.type, 5),
                "detail": c.description,
                "documentation": doc[:300] if doc else "",
                "insertText": c.name
            })
        return {"suggestions": results}
    except Exception as e:
        return {"suggestions": [], "error": str(e)}


def hover(code: str, line: int, column: int) -> dict:
    if not jedi or not code:
        return {"contents": []}

    try:
        script = jedi.Script(code)
        helps = script.help(line, column)
        contents = []
        for h in helps:
            desc = f"```python\n{h.description}\n```"
            doc = h.docstring().strip()
            if doc:
                desc += f"\n\n{doc}"
            contents.append({"value": desc})
        return {"contents": contents}
    except Exception as e:
        return {"contents": [], "error": str(e)}


def lint(code: str) -> dict:
    if not code or not code.strip():
        return {"errors": []}

    errors = []
    try:
        ast.parse(code)
        compile(code, "<editor>", "exec")
    except SyntaxError as e:
        errors.append({
            "line": e.lineno or 1,
            "column": e.offset or 1,
            "message": e.msg
        })
    except Exception as e:
        errors.append({
            "line": 1,
            "column": 1,
            "message": str(e)
        })

    return {"errors": errors}


def format_code(code: str) -> dict:
    if not black or not code.strip():
        return {"code": code}

    try:
        formatted = black.format_str(code, mode=black.Mode())
        return {"code": formatted}
    except Exception as e:
        return {"code": code, "error": str(e)}
