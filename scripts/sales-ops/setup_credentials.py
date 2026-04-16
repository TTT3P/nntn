#!/usr/bin/env python3
"""
setup_credentials.py — Interactive credential setup for NNTN Sales Ops P3 import

เก็บ username + password ของ 4 POS accounts ลงใน macOS Keychain ครั้งเดียว
หลังจากนั้น sales_ops_import.py จะดึงจาก Keychain โดยไม่ต้องถามซ้ำ

Usage:
  python3 setup_credentials.py              # prompt for any missing accounts
  python3 setup_credentials.py --force      # re-prompt all accounts (overwrite)
  python3 setup_credentials.py --delete     # remove all credentials from Keychain
  python3 setup_credentials.py --check      # list which accounts are configured
"""

import sys
import argparse
import getpass
import keyring
from keyring.errors import PasswordDeleteError

SERVICE_PREFIX = "nntn-sales-ops"

# POS accounts per COO routing (msg 1493636280125493359)
ACCOUNTS = [
    {
        "pos_account": "fs_noodle",
        "branch_id": "NT-NOODLE",
        "platform": "FoodStory",
        "label": "ร้านก๋วยเตี๋ยวเนื้อในตำนาน (FoodStory POS)",
        "fields": ["email", "password"],
    },
    {
        "pos_account": "fs_kitchen",
        "branch_id": "NT-KITCHEN",
        "platform": "FoodStory",
        "label": "ร้านครัวเนื้อในตำนาน (FoodStory POS)",
        "fields": ["email", "password"],
    },
    {
        "pos_account": "grab_noodle",
        "branch_id": "NT-NOODLE",
        "platform": "Grab Merchant",
        "label": "ร้านก๋วยเตี๋ยวเนื้อในตำนาน (Grab Merchant)",
        "fields": ["email", "password", "phone"],
    },
    {
        "pos_account": "grab_kitchen",
        "branch_id": "NT-KITCHEN",
        "platform": "Grab Merchant",
        "label": "ร้านครัวเนื้อในตำนาน (Grab Merchant)",
        "fields": ["email", "password", "phone"],
    },
]


def service_name(pos_account: str) -> str:
    return f"{SERVICE_PREFIX}-{pos_account}"


def has_credential(pos_account: str, field: str) -> bool:
    return keyring.get_password(service_name(pos_account), field) is not None


def get_credential(pos_account: str, field: str) -> str | None:
    return keyring.get_password(service_name(pos_account), field)


def set_credential(pos_account: str, field: str, value: str) -> None:
    keyring.set_password(service_name(pos_account), field, value)


def delete_credential(pos_account: str, field: str) -> bool:
    try:
        keyring.delete_password(service_name(pos_account), field)
        return True
    except PasswordDeleteError:
        return False


def prompt_account(account: dict, force: bool) -> int:
    """Prompt user for credentials of one account. Returns number of fields updated."""
    pos = account["pos_account"]
    print(f"\n━━━ {account['label']}")
    print(f"    pos_account = {pos}  |  branch_id = {account['branch_id']}")

    updated = 0
    for field in account["fields"]:
        existing = get_credential(pos, field)
        if existing and not force:
            print(f"    [{field}] ✅ already set (use --force to overwrite)")
            continue

        if field == "password":
            value = getpass.getpass(f"    [{field}] (hidden): ")
        else:
            prompt = f"    [{field}]"
            if field == "phone":
                prompt += " (เบอร์รับ OTP เช่น +66812345678)"
            value = input(prompt + ": ").strip()

        if not value:
            print(f"    [{field}] ⏭  skipped (empty)")
            continue

        set_credential(pos, field, value)
        updated += 1
        print(f"    [{field}] ✅ saved to Keychain")

    return updated


def cmd_setup(force: bool) -> None:
    print("━" * 60)
    print("🔐 NNTN Sales Ops — Credential Setup")
    print("━" * 60)
    print("Credentials จะถูกเก็บใน macOS Keychain (AES-256, OS-encrypted)")
    print(f"Service prefix: {SERVICE_PREFIX}-*")
    print(f"Backend: {type(keyring.get_keyring()).__name__}")

    total_updated = 0
    for account in ACCOUNTS:
        total_updated += prompt_account(account, force)

    print("\n" + "━" * 60)
    print(f"✅ Setup complete — {total_updated} credentials stored")
    print("━" * 60)
    print("\nNext step: run sales_ops_import.py to start importing data")


def cmd_check() -> None:
    print("━" * 60)
    print("🔍 Credential status")
    print("━" * 60)

    all_ok = True
    for account in ACCOUNTS:
        pos = account["pos_account"]
        print(f"\n{account['label']}  [{pos}]")
        for field in account["fields"]:
            present = has_credential(pos, field)
            mark = "✅" if present else "❌"
            print(f"    {mark} {field}")
            if not present:
                all_ok = False

    print("\n" + "━" * 60)
    if all_ok:
        print("✅ All credentials configured")
    else:
        print("⚠️  Some credentials missing — run setup_credentials.py")
    print("━" * 60)


def cmd_delete() -> None:
    print("━" * 60)
    print("🗑  Delete all NNTN Sales Ops credentials from Keychain")
    print("━" * 60)
    confirm = input("Type 'DELETE' to confirm: ").strip()
    if confirm != "DELETE":
        print("❌ Cancelled")
        return

    deleted = 0
    for account in ACCOUNTS:
        pos = account["pos_account"]
        for field in account["fields"]:
            if delete_credential(pos, field):
                deleted += 1
                print(f"    🗑  {pos}:{field}")

    print(f"\n✅ Deleted {deleted} credentials")


def main() -> int:
    parser = argparse.ArgumentParser(description="NNTN Sales Ops credential setup")
    parser.add_argument("--force", action="store_true", help="Overwrite existing credentials")
    parser.add_argument("--check", action="store_true", help="Check which credentials are set")
    parser.add_argument("--delete", action="store_true", help="Delete all credentials")
    args = parser.parse_args()

    if args.check:
        cmd_check()
    elif args.delete:
        cmd_delete()
    else:
        cmd_setup(force=args.force)

    return 0


if __name__ == "__main__":
    sys.exit(main())
