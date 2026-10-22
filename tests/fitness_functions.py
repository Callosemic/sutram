import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if REPO_ROOT.as_posix() not in sys.path:
    sys.path.insert(0, REPO_ROOT.as_posix())

from tests.fitness import run_all
from tests.fitness.core import FitnessState

if __name__ == "__main__":
    print("============================================================")
    print("       Sutram & yenVUI Architectural Fitness Validator      ")
    print("============================================================\n")

    run_all()

    print("============================================================")
    if FitnessState.violations_found == 0:
        print("✅ SUCCESS: Substrate complies with all presentation & IoC standards.")
        sys.exit(0)
    else:
        print(f"❌ FAILED: Found {FitnessState.violations_found} architectural violations.")
        sys.exit(1)