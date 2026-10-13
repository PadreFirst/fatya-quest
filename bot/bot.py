#!/usr/bin/env python3
"""Бот «Квесты Фати»: выдаёт кнопку запуска мини-аппа. Только stdlib, long polling."""
import json
import logging
import os
import time
import urllib.request

TOKEN = os.environ["BOT_TOKEN"]
WEBAPP_URL = os.environ["WEBAPP_URL"]
API = f"https://api.telegram.org/bot{TOKEN}/"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("fatya-bot")


def call(method, **params):
    req = urllib.request.Request(
        API + method,
        data=json.dumps(params).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=70) as r:
        return json.load(r)


def keyboard():
    return {"inline_keyboard": [[{"text": "🩺 ЗАПУСТИТЬ КВЕСТ", "web_app": {"url": WEBAPP_URL}}]]}


def setup():
    call("setChatMenuButton", menu_button={"type": "web_app", "text": "🩺 Квест", "web_app": {"url": WEBAPP_URL}})
    call("setMyCommands", commands=[{"command": "start", "description": "Начать квест"}])
    call("setMyShortDescription", short_description="Медицинский квест для Фати 🩺 Скальпели, кисты и УЗИ.")
    call("setMyDescription", description="Фатя, тебя ждёт медицинский квест: хирургическая точность, кисты и настоящее УЗИ-расследование. Жми «Начать»!")
    log.info("bot configured, webapp=%s", WEBAPP_URL)


def handle(update):
    msg = update.get("message")
    if not msg:
        return
    chat_id = msg["chat"]["id"]
    call(
        "sendMessage",
        chat_id=chat_id,
        parse_mode="HTML",
        text="🩺 <b>Фатин квест</b>\n\nСкальпели наточены, гель подогрет.\nЖми большую кнопку ниже 👇",
        reply_markup=keyboard(),
    )


def main():
    setup()
    offset = None
    while True:
        try:
            params = {"timeout": 50, "allowed_updates": ["message"]}
            if offset is not None:
                params["offset"] = offset
            res = call("getUpdates", **params)
            for upd in res.get("result", []):
                offset = upd["update_id"] + 1
                try:
                    handle(upd)
                except Exception:
                    log.exception("handle failed")
        except Exception:
            log.exception("polling failed")
            time.sleep(3)


if __name__ == "__main__":
    main()
