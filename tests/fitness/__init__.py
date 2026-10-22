from .rules_yenvui import check_yenvui_rules
from .rules_sutram import check_sutram_rules

def run_all():
    check_yenvui_rules()
    check_sutram_rules()