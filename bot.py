#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
🦄 UNICORN GOODS — Official Telegram Bot
Username: @Unicorngoods_bot
Features:
  - Force-Subscribe Channel Verification (@its_vivek_x_sakku)
  - Full Parity with Web Storefront & Realtime Database
  - Instant Universal Auto-Search on ANY typed text
  - Material Request & Bug Report Submissions with Live Status Tracking
  - Saved Goods / Bookmarks
  - Automated Notifications on Admin Replies & Updates
  - Direct Cloud Downloads & Community Explorer
==============================================================================
"""

import os
import sys
import html
import json
import re
import time
import base64
import random
import logging
import asyncio
from typing import Optional, Dict, Any, List

import httpx
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardRemove,
    constants,
    BotCommand,
)
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    ContextTypes,
    filters,
)

# -----------------------------------------------------------------------------
# 1. LOGGING CONFIGURATION
# -----------------------------------------------------------------------------
logging.basicConfig(
    format="%(asctime)s - [%(levelname)s] - %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("UnicornGoodsBot")

# -----------------------------------------------------------------------------
# 2. BOT & FIREBASE CREDENTIALS
# -----------------------------------------------------------------------------
BOT_TOKEN = os.getenv("BOT_TOKEN", "8910019479:AAHYV5pFGGXjpbjqv8ZdUqKslZDh7CBKqGk")
REQUIRED_CHANNEL = os.getenv("REQUIRED_CHANNEL", "@its_vivek_x_sakku")
REQUIRED_CHANNEL_ID = -1002187186013
REQUIRED_CHANNEL_URL = os.getenv("REQUIRED_CHANNEL_URL", "https://t.me/its_vivek_x_sakku")
FIREBASE_RTDB_URL = os.getenv(
    "FIREBASE_RTDB_URL", "https://unicorn-goods-default-rtdb.firebaseio.com"
).rstrip("/")

# In-memory session tracking for active users & notified requests
ADMIN_USER_IDS = set()
NOTIFIED_REQUEST_STATUS: Dict[str, str] = {}
NOTIFIED_REPORT_STATUS: Dict[str, str] = {}
NOTIFIED_BROADCAST_IDS: set = set()
BOT_START_TIME = int(time.time() * 1000)

# -----------------------------------------------------------------------------
# SEARCH UTILITIES & SYNONYMS (FAST LOCAL RTDB SEARCH)
# -----------------------------------------------------------------------------
STOP_WORDS = {
    "the", "a", "an", "is", "in", "for", "of", "to", "and", "or", "on", "at", "by", "with",
    "bhai", "bahi", "bro", "mujhe", "chahiye", "dedo", "karo", "please", "help",
    "kuch", "hai", "kya", "link", "download", "free", "app", "apk", "bot",
    "de", "do", "bhejo", "ka", "ki", "ke", "ko", "se", "aur", "ek", "par", "me", "mein",
    "give", "want", "need", "send", "plz", "pls",
}

SYNONYMS = {
    "book": ["book", "books", "pdf", "goodreads", "modules", "ncert"],
    "books": ["book", "books", "pdf", "goodreads", "modules", "ncert"],
    "notes": ["notes", "pdf", "study material", "goodreads", "modules"],
    "capcut": ["capcut", "video editor", "editing", "kinemaster"],
    "pw": ["pw", "physics wallah", "study rays", "pw thor", "study panda", "prime study"],
    "physics wallah": ["pw", "physics wallah", "study rays", "pw thor", "study panda"],
    "physics": ["physics", "pw", "iit", "jee", "neet"],
    "jee": ["jee", "iit", "modules", "allen", "free iit-jee"],
    "neet": ["neet", "ncert", "pyqs", "pyq", "allen"],
    "music": ["song", "spotify", "yt music", "song app"],
    "song": ["song", "spotify", "yt music", "song app"],
    "songs": ["song", "spotify", "yt music", "song app"],
    "youtube": ["vanced", "yt", "youtube"],
    "yt": ["vanced", "yt", "youtube"],
    "movies": ["netmirror", "vardaan", "cinema", "ott"],
    "movie": ["netmirror", "vardaan", "cinema", "ott"],
    "netflix": ["netmirror", "vardaan", "cinema"],
    "kinemaster": ["kinemaster", "video editor", "capcut"],
    "editing": ["capcut", "kinemaster", "video editor"],
}

def clean_query_tokens(query: str) -> List[str]:
    words = re.findall(r"\w+", query.lower())
    clean = [w for w in words if w not in STOP_WORDS and len(w) > 1]
    return clean if clean else [w for w in words if len(w) > 1]

def clean_telegram_html(text: str) -> str:
    """Converts markdown formatting to Telegram HTML and sanitizes stray entities."""
    if not text:
        return ""
    # Convert markdown formatting
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", text)
    # Sanitize stray '&' that aren't already valid HTML entities
    text = re.sub(r"&(?!amp;|lt;|gt;|quot;|#\d+;)", "&amp;", text)
    return text

# Conversation States
(
    REQ_NAME,
    REQ_CATEGORY,
    REQ_DETAILS,
    REP_REASON,
    REP_DETAILS,
) = range(5)

# -----------------------------------------------------------------------------
# 3. FIREBASE REALTIME DATABASE CLIENT (ASYNC REST API)
# -----------------------------------------------------------------------------
class FirebaseRTDB:
    @staticmethod
    async def get(path: str) -> Optional[Any]:
        url = f"{FIREBASE_RTDB_URL}/{path.lstrip('/')}.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            logger.error(f"Firebase GET error ({path}): {e}")
        return None

    @staticmethod
    async def post(path: str, data: Dict[str, Any]) -> Optional[str]:
        url = f"{FIREBASE_RTDB_URL}/{path.lstrip('/')}.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=data)
                if resp.status_code == 200:
                    res = resp.json()
                    return res.get("name") if res else None
        except Exception as e:
            logger.error(f"Firebase POST error ({path}): {e}")
        return None

    @staticmethod
    async def patch(path: str, data: Dict[str, Any]) -> bool:
        url = f"{FIREBASE_RTDB_URL}/{path.lstrip('/')}.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.patch(url, json=data)
                return resp.status_code == 200
        except Exception as e:
            logger.error(f"Firebase PATCH error ({path}): {e}")
        return False

    @staticmethod
    async def put(path: str, data: Any) -> bool:
        url = f"{FIREBASE_RTDB_URL}/{path.lstrip('/')}.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.put(url, json=data)
                return resp.status_code == 200
        except Exception as e:
            logger.error(f"Firebase PUT error ({path}): {e}")
        return False

    @staticmethod
    async def get_products() -> List[Dict[str, Any]]:
        raw = await FirebaseRTDB.get("products")
        if not raw or not isinstance(raw, dict):
            return []
        products = []
        for pid, pdata in raw.items():
            if isinstance(pdata, dict) and pdata.get("status") == "published":
                pdata["id"] = pid
                products.append(pdata)
        products.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return products

    @staticmethod
    async def get_all_products_raw() -> List[Dict[str, Any]]:
        raw = await FirebaseRTDB.get("products")
        if not raw or not isinstance(raw, dict):
            return []
        products = []
        for pid, pdata in raw.items():
            if isinstance(pdata, dict):
                pdata["id"] = pid
                products.append(pdata)
        products.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return products

    @staticmethod
    async def register_bot_user(user) -> None:
        if not user:
            return
        user_data = {
            "id": user.id,
            "username": user.username or "",
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "lastActive": int(time.time() * 1000),
        }
        await FirebaseRTDB.put(f"bot_users/{user.id}", user_data)

    @staticmethod
    async def get_all_bot_users() -> List[int]:
        raw = await FirebaseRTDB.get("bot_users")
        if not raw or not isinstance(raw, dict):
            return []
        return [int(uid) for uid in raw.keys() if uid.isdigit()]

# -----------------------------------------------------------------------------
# 4. FORCE-SUBSCRIBE VERIFICATION (FSUB)
# -----------------------------------------------------------------------------
async def check_channel_membership(user_id: int, bot) -> bool:
    """Verifies whether the user is a member of @its_vivek_x_sakku (ID: -1002187186013)."""
    targets = [REQUIRED_CHANNEL_ID, REQUIRED_CHANNEL]
    for target in targets:
        try:
            member = await bot.get_chat_member(chat_id=target, user_id=user_id)
            status_str = str(getattr(member.status, "value", member.status)).lower()
            if status_str in ["owner", "creator", "administrator", "member", "restricted"]:
                return True
            elif status_str in ["left", "banned", "kicked"]:
                return False
        except Exception as e:
            err_str = str(e).lower()
            if "user not found" in err_str or "participant" in err_str:
                return False
            if "member list is inaccessible" in err_str or "chat_admin_required" in err_str:
                logger.warning(
                    f"⚠️ Bot must be added as an Administrator to channel {target} to verify members."
                )
                return False
    return False

def get_fsub_keyboard() -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton("📢 Join Official Channel ↗", url=REQUIRED_CHANNEL_URL)],
        [InlineKeyboardButton("✅ I Have Joined / Verify", callback_data="verify_membership")],
    ]
    return InlineKeyboardMarkup(buttons)

async def send_fsub_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "🦄 <b>Welcome to UNICORN GOODS!</b>\n"
        "<i>Curated Free Digital Library & Study Hub</i>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "⚠️ <b>Channel Membership Required</b>\n\n"
        "To prevent spam and keep all materials, notes, APKs, and direct high-speed cloud "
        "downloads 100% free, you must be a member of our official channel:\n\n"
        f"📢 <b>Channel:</b> {REQUIRED_CHANNEL}\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "👉 <i>Click the button below to join, then press <b>Verify</b> to unlock the bot!</i>"
    )
    if update.callback_query:
        await update.callback_query.answer("⚠️ Please join our channel first!", show_alert=True)
        try:
            await update.callback_query.edit_message_text(
                text, parse_mode=constants.ParseMode.HTML, reply_markup=get_fsub_keyboard()
            )
        except Exception:
            pass
    elif update.effective_message:
        await update.effective_message.reply_text(
            text, parse_mode=constants.ParseMode.HTML, reply_markup=get_fsub_keyboard()
        )

# -----------------------------------------------------------------------------
# 5. UI COMPONENTS & KEYBOARDS
# -----------------------------------------------------------------------------
def get_main_menu_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("📚 Study Materials", callback_data="cat:Study Material"),
            InlineKeyboardButton("📝 Notes & PDFs", callback_data="cat:Notes"),
        ],
        [
            InlineKeyboardButton("📱 APKs & Android", callback_data="cat:APK"),
            InlineKeyboardButton("💻 Software & PC", callback_data="cat:Software"),
        ],
        [
            InlineKeyboardButton("🛠️ Tools & Utilities", callback_data="cat:Tools"),
            InlineKeyboardButton("🌐 All Goods", callback_data="cat:All"),
        ],
        [
            InlineKeyboardButton("🔍 Search Material", callback_data="nav:search"),
            InlineKeyboardButton("➕ Request Item", callback_data="nav:request"),
        ],
        [
            InlineKeyboardButton("📋 My Requests & Activity", callback_data="nav:activity"),
            InlineKeyboardButton("⭐ Saved Goods", callback_data="nav:saved"),
        ],
        [
            InlineKeyboardButton("ℹ️ About UNICORN", callback_data="nav:about"),
            InlineKeyboardButton("📢 Announcements", callback_data="nav:popup"),
        ],
        [
            InlineKeyboardButton("🌐 Open Web Storefront ↗", url="https://unicorngoods.vercel.app"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)

def get_product_card_keyboard(product: Dict[str, Any], user_id: int) -> InlineKeyboardMarkup:
    pid = product.get("id", "")
    file_url = (product.get("fileUrl") or product.get("downloadUrl") or product.get("link") or "").strip()
    buttons = []
    if file_url and file_url.startswith("http"):
        buttons.append([InlineKeyboardButton("📥 GET NOW (Direct Link) ↗", url=file_url)])
    else:
        buttons.append([InlineKeyboardButton("📥 Download (Ask Admin)", callback_data=f"req_prefill:{product.get('title')}")])
    buttons.append([
        InlineKeyboardButton("⭐ Save", callback_data=f"save:{pid}"),
        InlineKeyboardButton("⚠️ Report Issue", callback_data=f"report_item:{pid}"),
    ])
    buttons.append([InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")])
    return InlineKeyboardMarkup(buttons)

def get_category_pagination_keyboard(
    category: str, page: int, total_pages: int, count: int
) -> InlineKeyboardMarkup:
    row = []
    if page > 0:
        row.append(InlineKeyboardButton("◀️ Previous", callback_data=f"page:{category}:{page - 1}"))
    row.append(InlineKeyboardButton(f"📄 {page + 1}/{max(1, total_pages)} ({count})", callback_data="noop"))
    if page < total_pages - 1:
        row.append(InlineKeyboardButton("Next ▶️", callback_data=f"page:{category}:{page + 1}"))

    buttons = [row] if row else []
    buttons.append([InlineKeyboardButton("🔙 Back to Categories", callback_data="nav:categories")])
    buttons.append([InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")])
    return InlineKeyboardMarkup(buttons)

# -----------------------------------------------------------------------------
# 6. COMMAND HANDLERS
# -----------------------------------------------------------------------------
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    msg = update.effective_message
    chat = update.effective_chat
    bot_username = context.bot.username or "Unicorngoods_bot"

    is_group = chat.type in [constants.ChatType.GROUP, constants.ChatType.SUPERGROUP]

    # Handle Group / Supergroup chats
    if is_group:
        group_text = (
            "🦄 <b>UNICORN GOODS Bot is active in this group!</b>\n\n"
            "Access curated free study materials, notes, APKs, PC software, and tools.\n\n"
            "⚡ <b>Available Group Commands:</b>\n"
            "• 🔍 <code>/search &lt;item&gt;</code> — Search materials directly in this group\n"
            "• ➕ <code>/request</code> — Request missing books, notes or tools\n"
            "• ⚠️ <code>/report</code> — Report a broken link or issue\n"
            "• 📖 <code>/help</code> — View bot command list & guide"
        )
        keyboard = [
            [
                InlineKeyboardButton("➕ Request Material (DM) ↗", url=f"https://t.me/{bot_username}?start=request"),
                InlineKeyboardButton("⚠️ Report Issue (DM) ↗", url=f"https://t.me/{bot_username}?start=report"),
            ],
            [
                InlineKeyboardButton("🌐 Open Web Storefront ↗", url="https://unicorngoods.vercel.app"),
                InlineKeyboardButton("🦄 Open Bot in DM ↗", url=f"https://t.me/{bot_username}?start=menu"),
            ],
        ]
        await msg.reply_text(
            group_text,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
        return

    # Private 1-on-1 Chat Handling
    await FirebaseRTDB.register_bot_user(user)

    # Force-Subscribe check (Private chat only)
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    # Check maintenance mode
    maint = await FirebaseRTDB.get("settings/maintenance")
    if maint and maint.get("enabled") is True and user.id not in ADMIN_USER_IDS:
        m_title = maint.get("title", "Under Maintenance")
        m_msg = maint.get("message", "We are upgrading UNICORN GOODS. Please check back shortly!")
        await msg.reply_text(
            f"🚧 <b>{html.escape(m_title)}</b>\n\n{html.escape(m_msg)}",
            parse_mode=constants.ParseMode.HTML,
        )
        return

    # Handle deep link args (e.g. /start prod_-P-xxxxxx, /start report, /start request, /start req_prefill_xxx)
    if context.args and len(context.args) > 0:
        arg = context.args[0].strip()
        if arg.startswith("prod_"):
            pid = arg.replace("prod_", "")
            await show_product_detail(update, pid)
            return
        elif arg == "report":
            await msg.reply_text(
                "⚠️ <b>Report an Issue / Broken Link</b>\n\nTap below to select the reason for your report:",
                parse_mode=constants.ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⚠️ Start Report Now", callback_data="report_item:GENERAL")]]),
            )
            return
        elif arg == "request":
            await msg.reply_text(
                "➕ <b>Request Study Material or Software</b>\n\nTap below to submit your request:",
                parse_mode=constants.ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("➕ Start Request Now", callback_data="nav:request")]]),
            )
            return
        elif arg.startswith("req_prefill_"):
            cand = arg.replace("req_prefill_", "").replace("_", " ")
            await msg.reply_text(
                f"➕ <b>Request Material:</b> <code>{html.escape(cand)}</code>\n\nTap below to proceed with your request:",
                parse_mode=constants.ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(f"➕ Request '{cand[:20]}'", callback_data=f"req_prefill:{cand}")]])
            )
            return
        elif arg == "search":
            await msg.reply_text(
                "🔍 <b>Universal Material Search</b>\n\nType any book, note, APK or software name directly in chat to search!",
                parse_mode=constants.ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("📚 Browse Categories", callback_data="nav:categories")]]),
            )
            return

    welcome_text = (
        f"👋 <b>Welcome, {html.escape(user.first_name or 'Friend')}!</b>\n\n"
        "🦄 <b>UNICORN GOODS — Official Telegram Bot</b>\n"
        "<i>Curated Free Digital Download Library & Study Hub</i>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "Explore verified, high-speed cloud downloads with <b>zero ads</b> and <b>zero wait timers</b>:\n\n"
        "• 📚 <b>Books & Notes:</b> NCERT, NEET PYQs, JEE Modules, Handwritten Notes\n"
        "• 📱 <b>Premium APKs:</b> Video Editors, Tools, Utilities, Ad-free Apps\n"
        "• 💻 <b>Study Batches:</b> PW, Physics Wallah, Unacademy, Allen, Testbook\n"
        "• 🛠️ <b>Software & Tools:</b> Windows & Mac Utilities, Media Tools\n\n"
        "🔍 <b>Instant Search:</b> Type any material name directly in this chat anytime!"
    )

    keyboard = [
        [
            InlineKeyboardButton("📚 Browse Categories", callback_data="nav:categories"),
            InlineKeyboardButton("🔍 Search Library", callback_data="nav:search"),
        ],
        [
            InlineKeyboardButton("➕ Request Any Item", callback_data="nav:request"),
            InlineKeyboardButton("⭐ My Saved Goods", callback_data="nav:saved"),
        ],
        [
            InlineKeyboardButton("📋 My Activity & Status", callback_data="nav:activity"),
            InlineKeyboardButton("ℹ️ About UNICORN", callback_data="nav:about"),
        ],
        [
            InlineKeyboardButton("🌐 Open Web Storefront ↗", url="https://unicorngoods.vercel.app"),
        ],
    ]

    await msg.reply_text(
        welcome_text,
        parse_mode=constants.ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard),
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user
    is_group = chat.type in [constants.ChatType.GROUP, constants.ChatType.SUPERGROUP]

    if is_group:
        help_text = (
            "📖 <b>UNICORN GOODS Group Commands:</b>\n\n"
            "🔍 <code>/search &lt;item name&gt;</code> — Search notes, books, APKs or software directly\n"
            "➕ <code>/request</code> — Request missing study material or software (via DM)\n"
            "⚠️ <code>/report</code> — Report a broken download link or issue (via DM)\n"
            "📚 <code>/menu</code> — Group overview and library links\n"
            "📖 <code>/help</code> — Show this commands guide"
        )
        await update.effective_message.reply_text(help_text, parse_mode=constants.ParseMode.HTML)
        return

    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    help_text = (
        "💡 <b>UNICORN GOODS Bot Guide:</b>\n\n"
        "🔍 <b>Instant Search:</b> Just type any topic (e.g. <code>Python</code>, <code>NEET</code>, <code>Capcut</code>) directly in chat!\n"
        "📚 <b>/menu:</b> Open the main category explorer.\n"
        "➕ <b>/request:</b> Request any study material or software not currently in the library.\n"
        "⚠️ <b>/report:</b> Report a broken download link or issue.\n"
        "📋 <b>/activity:</b> Track your submitted requests and view admin replies.\n"
        "⭐ <b>/saved:</b> View your bookmarked materials.\n"
        "ℹ️ <b>/about:</b> Community guidelines, mission & contact links.\n"
        "📢 <b>/announcement:</b> View latest platform announcements."
    )
    await update.effective_message.reply_text(help_text, parse_mode=constants.ParseMode.HTML)

# -----------------------------------------------------------------------------
# 7. CATEGORY BROWSER & PAGINATION
# -----------------------------------------------------------------------------
ITEMS_PER_PAGE = 4

async def render_category_page(
    query, category: str, page: int, user_id: int
) -> None:
    products = await FirebaseRTDB.get_products()
    if category != "All":
        filtered = [p for p in products if p.get("category") == category]
    else:
        filtered = products

    total_count = len(filtered)
    total_pages = (total_count + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE

    if total_count == 0:
        text = (
            f"📂 <b>Category: {html.escape(category)}</b>\n\n"
            "<i>No materials found in this category yet.</i>\n\n"
            "💡 You can request our team to add it using the <b>Request Item</b> button!"
        )
        keyboard = [
            [InlineKeyboardButton("➕ Request an Item", callback_data="nav:request")],
            [InlineKeyboardButton("🔙 Back to Categories", callback_data="nav:categories")],
        ]
        await query.edit_message_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    page = max(0, min(page, total_pages - 1))
    start_idx = page * ITEMS_PER_PAGE
    end_idx = min(start_idx + ITEMS_PER_PAGE, total_count)
    page_items = filtered[start_idx:end_idx]

    text = (
        f"📂 <b>{html.escape(category.upper())}</b> ({total_count} total items)\n"
        f"<i>Page {page + 1} of {total_pages}</i>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )

    item_buttons = []
    for idx, p in enumerate(page_items, start=start_idx + 1):
        title = p.get("title", "Untitled")
        cat = p.get("category", "Other")
        desc = (p.get("desc") or "").strip()
        if len(desc) > 80:
            desc = desc[:77] + "..."
        desc_line = f"   <i>{html.escape(desc)}</i>\n" if desc else ""
        text += f"<b>{idx}. {html.escape(title)}</b> [{html.escape(cat)}]\n{desc_line}\n"
        item_buttons.append([
            InlineKeyboardButton(f"📄 View #{idx}: {title[:25]}", callback_data=f"view_prod:{p['id']}")
        ])

    nav_keyboard = get_category_pagination_keyboard(category, page, total_pages, total_count)
    combined_buttons = item_buttons + nav_keyboard.inline_keyboard

    await query.edit_message_text(
        text,
        parse_mode=constants.ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(combined_buttons),
    )

async def show_product_detail(update: Update, product_id: str) -> None:
    query = update.callback_query
    msg = update.effective_message
    user_id = update.effective_user.id if update.effective_user else 0
    products = await FirebaseRTDB.get_all_products_raw()
    product = next((p for p in products if p.get("id") == product_id), None)

    if not product:
        if query:
            await query.answer("Material not found or deleted.", show_alert=True)
        elif msg:
            await msg.reply_text("⚠️ Material not found or deleted.")
        return

    title = product.get("title", "Untitled")
    category = product.get("category", "General")
    desc = product.get("desc", "No description provided.")
    img_url = product.get("imgUrl", "").strip()

    caption = (
        f"📦 <b>{html.escape(title)}</b>\n"
        f"🏷️ <b>Category:</b> <code>{html.escape(category)}</code>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📝 <b>Description:</b>\n{html.escape(desc)}\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "⚡ <i>Verified Direct Cloud Download</i>"
    )

    keyboard = get_product_card_keyboard(product, user_id)

    # Try sending photo if available
    if img_url and img_url.startswith("http"):
        try:
            if query and query.message:
                await query.message.reply_photo(
                    photo=img_url,
                    caption=caption,
                    parse_mode=constants.ParseMode.HTML,
                    reply_markup=keyboard,
                )
                await query.answer()
                return
            elif msg:
                await msg.reply_photo(
                    photo=img_url,
                    caption=caption,
                    parse_mode=constants.ParseMode.HTML,
                    reply_markup=keyboard,
                )
                return
        except Exception as e:
            logger.debug(f"Photo send fallback: {e}")

    # Text fallback
    if query:
        await query.edit_message_text(
            caption,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )
    elif msg:
        await msg.reply_text(
            caption,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )

# -----------------------------------------------------------------------------
# 8. CATALOG SEARCH ENGINE & UNIVERSAL TEXT HANDLER
# -----------------------------------------------------------------------------

def find_matching_products(query_text: str, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Finds products matching terms in the query with semantic synonym expansion and strict word boundary scoring."""
    tokens = clean_query_tokens(query_text)
    if not tokens:
        return []

    expanded_terms = set(tokens)
    for t in tokens:
        if t in SYNONYMS:
            expanded_terms.update(SYNONYMS[t])
        if t.endswith("s") and len(t) > 3:
            expanded_terms.add(t[:-1])
        else:
            expanded_terms.add(t + "s")

    scored = []
    for p in products:
        title = (p.get("title") or "").lower()
        desc = (p.get("desc") or p.get("description") or "").lower()
        cat = (p.get("category") or "").lower()
        full_text = f"{title} {cat} {desc}"

        score = 0
        # Check direct token matches
        for t in tokens:
            pattern = r"\b" + re.escape(t) + r"\b"
            if re.search(pattern, title, re.I):
                score += 80  # Exact whole word in title!
            elif len(t) >= 4 and t in title:
                score += 35  # Substring only if token is 4+ chars!
            elif re.search(pattern, full_text, re.I):
                score += 15  # Exact whole word in desc/cat!

        # Check expanded synonym terms
        for et in expanded_terms:
            pattern = r"\b" + re.escape(et) + r"\b"
            if re.search(pattern, title, re.I):
                score += 40
            elif len(et) >= 4 and et in title:
                score += 20
            elif re.search(pattern, full_text, re.I):
                score += 10

        if score >= 20:  # Robust threshold to eliminate false positives
            scored.append((p, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [item[0] for item in scored[:4]]


async def execute_catalog_search(
    update: Update, context: ContextTypes.DEFAULT_TYPE, query_text: str, is_group: bool
) -> None:
    """Fast, deterministic search executing against Firebase RTDB for groups and private chats."""
    msg = update.effective_message
    bot_username = context.bot.username or "Unicorngoods_bot"
    products = await FirebaseRTDB.get_products()
    matched = find_matching_products(query_text, products)

    # -------------------------------------------------------------------------
    # A. GROUP CHAT SEARCH RESULTS
    # -------------------------------------------------------------------------
    if is_group:
        if matched:
            result_lines = []
            buttons = []
            for idx, p in enumerate(matched[:3], 1):
                title = p.get("title", "Item")
                cat = p.get("category", "General")
                file_url = (p.get("fileUrl") or p.get("downloadUrl") or p.get("link") or "").strip()
                result_lines.append(f"<b>{idx}. {html.escape(title)}</b> [<code>{html.escape(cat)}</code>]")

                row = []
                if file_url and file_url.startswith("http"):
                    row.append(InlineKeyboardButton(f"📥 Download #{idx} ↗", url=file_url))
                row.append(InlineKeyboardButton(f"📄 View in DM ↗", url=f"https://t.me/{bot_username}?start=prod_{p.get('id')}"))
                buttons.append(row)

            buttons.append([
                InlineKeyboardButton("🌐 Web Storefront ↗", url="https://unicorngoods.vercel.app"),
                InlineKeyboardButton("🦄 Open Bot in DM ↗", url=f"https://t.me/{bot_username}?start=menu"),
            ])

            reply_text = (
                f"🔍 <b>Search Results for:</b> <code>{html.escape(query_text)}</code>\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                + "\n".join(result_lines)
                + "\n\n👉 <i>Tap below to download directly or view full details in private DM:</i>"
            )
            await msg.reply_text(
                reply_text,
                parse_mode=constants.ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup(buttons),
                disable_web_page_preview=True,
            )
        else:
            safe_q = re.sub(r"[^a-zA-Z0-9_\- ]", "", query_text).strip().replace(" ", "_")
            buttons = [
                [InlineKeyboardButton(f"➕ Request '{query_text[:20]}' in DM ↗", url=f"https://t.me/{bot_username}?start=req_prefill_{safe_q[:25]}")],
                [InlineKeyboardButton("🌐 Search on Web Storefront ↗", url="https://unicorngoods.vercel.app")],
            ]
            reply_text = (
                f"❌ No materials found matching '<b>{html.escape(query_text)}</b>' in the library.\n\n"
                "💡 You can request this item from our admin team via our private bot!"
            )
            await msg.reply_text(
                reply_text,
                parse_mode=constants.ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup(buttons),
            )
        return

    # -------------------------------------------------------------------------
    # B. PRIVATE CHAT SEARCH RESULTS
    # -------------------------------------------------------------------------
    if len(matched) == 1:
        await show_product_detail(update, matched[0]["id"])
    elif len(matched) > 1:
        buttons = []
        res_lines = []
        for idx, p in enumerate(matched[:5], 1):
            p_title = p.get("title", "Item")
            p_cat = p.get("category", "General")
            file_url = (p.get("fileUrl") or p.get("downloadUrl") or p.get("link") or "").strip()
            res_lines.append(f"<b>{idx}. {html.escape(p_title)}</b> [<code>{html.escape(p_cat)}</code>]")

            row = []
            if file_url and file_url.startswith("http"):
                row.append(InlineKeyboardButton(f"📥 Download #{idx} ↗", url=file_url))
            row.append(InlineKeyboardButton(f"📄 Details #{idx}", callback_data=f"view_prod:{p['id']}"))
            buttons.append(row)

        buttons.append([InlineKeyboardButton("➕ Request Another Item", callback_data="nav:request")])
        buttons.append([InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")])

        reply_text = (
            f"🔍 <b>Found {len(matched)} matching materials for '<code>{html.escape(query_text)}</code>':</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            + "\n".join(res_lines)
            + "\n\n👉 <i>Select an option below:</i>"
        )
        await msg.reply_text(
            reply_text,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(buttons),
            disable_web_page_preview=True,
        )
    else:
        safe_q = query_text[:30]
        reply_text = (
            f"🔍 No materials found matching '<b>{html.escape(query_text)}</b>' in UNICORN GOODS library.\n\n"
            "Would you like our admin team to upload this item for you?"
        )
        buttons = [
            [InlineKeyboardButton(f"➕ Request '{safe_q[:20]}'", callback_data=f"req_prefill:{safe_q}")],
            [InlineKeyboardButton("📚 Browse Categories", callback_data="nav:categories")],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
        ]
        await msg.reply_text(
            reply_text,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(buttons),
        )


async def handle_user_text_search(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles direct text messages typed by users in groups or private chats."""
    user = update.effective_user
    msg = update.effective_message
    chat = update.effective_chat
    if not msg or not msg.text:
        return

    query_text = msg.text.strip()
    is_group = chat.type in [constants.ChatType.GROUP, constants.ChatType.SUPERGROUP]
    bot_username = (context.bot.username or "Unicorngoods_bot").lower()

    # -------------------------------------------------------------------------
    # A. GROUP CHATS: Only reply when explicitly called or replied to
    # -------------------------------------------------------------------------
    if is_group:
        is_reply_to_bot = (
            msg.reply_to_message
            and msg.reply_to_message.from_user
            and msg.reply_to_message.from_user.id == context.bot.id
        )
        is_mentioned = f"@{bot_username}" in query_text.lower()

        if not (is_reply_to_bot or is_mentioned):
            return

        clean_text = re.sub(rf"@{bot_username}", "", query_text, flags=re.I).strip()
        if not clean_text:
            await msg.reply_text(
                "🔍 <b>How to search in this group:</b>\n"
                "Type: <code>/search &lt;item name&gt;</code>\n"
                "<i>Example:</i> <code>/search CapCut</code> or <code>/search NEET Notes</code>",
                parse_mode=constants.ParseMode.HTML,
            )
            return

        await execute_catalog_search(update, context, clean_text, is_group=True)
        return

    # -------------------------------------------------------------------------
    # B. PRIVATE CHATS: Universal Search & Quick Greetings
    # -------------------------------------------------------------------------
    await FirebaseRTDB.register_bot_user(user)

    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    q_lower = query_text.lower()
    if q_lower in ["hi", "hello", "hey", "hlo", "yo", "namaste", "pranam"]:
        welcome_text = (
            f"👋 <b>Hello {html.escape(user.first_name or 'Friend')}!</b>\n\n"
            "Welcome to <b>UNICORN GOODS</b>! 🦄\n"
            "How can I help you today?\n\n"
            "• Type any subject, book, or software name to search instantly!\n"
            "• Or browse through the categories below:"
        )
        buttons = [
            [
                InlineKeyboardButton("📚 Browse Categories", callback_data="nav:categories"),
                InlineKeyboardButton("🔍 Search Library", callback_data="nav:search"),
            ],
            [
                InlineKeyboardButton("➕ Request Any Item", callback_data="nav:request"),
                InlineKeyboardButton("⭐ My Saved Goods", callback_data="nav:saved"),
            ],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
        ]
        await msg.reply_text(
            welcome_text,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return

    try:
        await context.bot.send_chat_action(chat_id=msg.chat_id, action=constants.ChatAction.TYPING)
    except Exception:
        pass

    await execute_catalog_search(update, context, query_text, is_group=False)


async def handle_user_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Guides users to text search or item request when photos are sent."""
    user = update.effective_user
    msg = update.effective_message
    chat = update.effective_chat
    if not msg or not msg.photo:
        return

    is_group = chat.type in [constants.ChatType.GROUP, constants.ChatType.SUPERGROUP]
    if is_group:
        return

    await FirebaseRTDB.register_bot_user(user)
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    if msg.caption:
        await execute_catalog_search(update, context, msg.caption.strip(), is_group=False)
        return

    reply_text = (
        "📸 <b>Photo received!</b>\n\n"
        "To search for books, notes, APKs, or software, please type its name directly in chat "
        "(e.g. <code>NEET Physics Notes</code> or <code>CapCut Pro</code>).\n\n"
        "If you need an item that isn't yet available, tap below to submit a request:"
    )
    buttons = [
        [InlineKeyboardButton("🔍 Search Library", callback_data="nav:search")],
        [InlineKeyboardButton("➕ Request Material", callback_data="nav:request")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
    ]
    await msg.reply_text(
        reply_text,
        parse_mode=constants.ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def handle_user_audio(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles audio messages sent by users."""
    user = update.effective_user
    msg = update.effective_message
    chat = update.effective_chat
    if not msg:
        return

    is_group = chat.type in [constants.ChatType.GROUP, constants.ChatType.SUPERGROUP]
    if is_group:
        return

    await FirebaseRTDB.register_bot_user(user)
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    if msg.caption:
        await execute_catalog_search(update, context, msg.caption.strip(), is_group=False)
        return

    reply_text = (
        "🎙️ <b>Voice note received!</b>\n\n"
        "Please type the material or app name directly in chat to search our library "
        "(e.g. <code>CapCut</code>, <code>NEET Notes</code>, <code>Kinemaster</code>).\n\n"
        "You can also request missing materials using the button below:"
    )
    buttons = [
        [InlineKeyboardButton("🔍 Search Library", callback_data="nav:search")],
        [InlineKeyboardButton("➕ Request Material", callback_data="nav:request")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
    ]
    await msg.reply_text(
        reply_text,
        parse_mode=constants.ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(buttons),
    )

# -----------------------------------------------------------------------------
# 9. REQUEST MATERIAL FLOW (CONVERSATION HANDLER)
# -----------------------------------------------------------------------------
async def start_request_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    chat = update.effective_chat
    if chat and chat.type in [constants.ChatType.GROUP, constants.ChatType.SUPERGROUP]:
        bot_username = context.bot.username or "Unicorngoods_bot"
        prompt = (
            "➕ <b>Request Study Material or Software</b>\n\n"
            "To submit a material request without cluttering this group, please tap below to open our 1-on-1 private chat:"
        )
        buttons = [
            [InlineKeyboardButton("➕ Submit Request in DM ↗", url=f"https://t.me/{bot_username}?start=request")],
        ]
        if update.callback_query:
            await update.callback_query.answer()
        await update.effective_message.reply_text(
            prompt,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return ConversationHandler.END

    query = update.callback_query
    prefill = ""
    if query and query.data.startswith("req_prefill:"):
        prefill = query.data.split("req_prefill:")[1].strip()

    prompt = (
        "➕ <b>Request Study Material or Software</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "Can't find the notes, book, APK, or tool you need? Let our team know!\n\n"
        "👉 <b>Step 1/3:</b> What is the <b>Name / Title</b> of the material you need?\n"
        "<i>(Send /cancel anytime to abort)</i>"
    )

    if prefill:
        context.user_data["req_name"] = prefill
        cat_prompt = (
            f"📦 <b>Material Name:</b> <code>{html.escape(prefill)}</code>\n\n"
            "👉 <b>Step 2/3:</b> Select the category for this item:"
        )
        cat_keyboard = [
            [
                InlineKeyboardButton("Study Material", callback_data="req_cat:Study Material"),
                InlineKeyboardButton("Notes & PDFs", callback_data="req_cat:Notes"),
            ],
            [
                InlineKeyboardButton("APK / Android", callback_data="req_cat:APK"),
                InlineKeyboardButton("Software (PC/Mac)", callback_data="req_cat:Software"),
            ],
            [
                InlineKeyboardButton("Tools & Utilities", callback_data="req_cat:Tools"),
                InlineKeyboardButton("Other", callback_data="req_cat:Other"),
            ],
        ]
        if query:
            await query.edit_message_text(cat_prompt, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(cat_keyboard))
        return REQ_CATEGORY

    if query:
        await query.edit_message_text(prompt, parse_mode=constants.ParseMode.HTML)
    elif update.effective_message:
        await update.effective_message.reply_text(prompt, parse_mode=constants.ParseMode.HTML)
    return REQ_NAME

async def request_name_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    item_name = update.effective_message.text.strip()
    if len(item_name) < 2:
        await update.effective_message.reply_text("Please enter a valid material name (at least 2 characters):")
        return REQ_NAME

    context.user_data["req_name"] = item_name

    cat_prompt = (
        f"📦 <b>Material:</b> <code>{html.escape(item_name)}</code>\n\n"
        "👉 <b>Step 2/3:</b> Choose the category for this item:"
    )
    cat_keyboard = [
        [
            InlineKeyboardButton("Study Material", callback_data="req_cat:Study Material"),
            InlineKeyboardButton("Notes & PDFs", callback_data="req_cat:Notes"),
        ],
        [
            InlineKeyboardButton("APK / Android", callback_data="req_cat:APK"),
            InlineKeyboardButton("Software (PC/Mac)", callback_data="req_cat:Software"),
        ],
        [
            InlineKeyboardButton("Tools & Utilities", callback_data="req_cat:Tools"),
            InlineKeyboardButton("Other", callback_data="req_cat:Other"),
        ],
    ]
    await update.effective_message.reply_text(cat_prompt, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(cat_keyboard))
    return REQ_CATEGORY

async def request_cat_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    category = query.data.split("req_cat:")[1]
    context.user_data["req_category"] = category

    prompt = (
        f"🏷️ <b>Category:</b> <code>{html.escape(category)}</code>\n\n"
        "👉 <b>Step 3/3:</b> Provide any additional details (Author, Semester, Version, Subject, etc.):\n"
        "<i>(Or send <code>none</code> if no details)</i>"
    )
    await query.edit_message_text(prompt, parse_mode=constants.ParseMode.HTML)
    return REQ_DETAILS

async def request_details_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    details = update.effective_message.text.strip()
    if details.lower() == "none":
        details = ""

    user = update.effective_user
    req_name = context.user_data.get("req_name", "Untitled")
    req_category = context.user_data.get("req_category", "Study Material")

    payload = {
        "itemName": req_name,
        "userName": user.full_name or user.username or f"User_{user.id}",
        "category": req_category,
        "details": details,
        "status": "pending",
        "adminReply": "",
        "timestamp": int(time.time() * 1000),
        "telegramUserId": user.id,
        "telegramUsername": f"@{user.username}" if user.username else "",
    }

    req_id = await FirebaseRTDB.post("requests", payload)
    ticket_no = req_id[-6:].upper() if req_id else "SUBMITTED"

    confirm_text = (
        "🎉 <b>Request Submitted Successfully!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🎫 <b>Ticket ID:</b> <code>#REQ-{ticket_no}</code>\n"
        f"📦 <b>Item:</b> {html.escape(req_name)}\n"
        f"🏷️ <b>Category:</b> {html.escape(req_category)}\n"
        f"📝 <b>Details:</b> {html.escape(details or 'None')}\n"
        f"⏳ <b>Status:</b> <code>Pending Admin Review</code>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "🔔 <i>You will receive a notification DM from this bot as soon as an admin approves or replies to your request!</i>"
    )
    keyboard = [
        [InlineKeyboardButton("📋 Track My Requests", callback_data="nav:activity")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
    ]
    await update.effective_message.reply_text(confirm_text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))

    # Alert all active bot admins
    admin_alert = (
        f"🔔 <b>New Item Request Alert!</b>\n\n"
        f"From: {html.escape(user.full_name)} ({payload['telegramUsername']})\n"
        f"Item: <b>{html.escape(req_name)}</b> [{req_category}]\n"
        f"Details: {html.escape(details)}\n"
        f"Ticket: <code>#REQ-{ticket_no}</code>"
    )
    for admin_id in ADMIN_USER_IDS:
        try:
            btn = InlineKeyboardMarkup([[InlineKeyboardButton("💬 Reply & Approve", callback_data=f"adm_rep_req:{req_id}")]])
            await context.bot.send_message(chat_id=admin_id, text=admin_alert, parse_mode=constants.ParseMode.HTML, reply_markup=btn)
        except Exception:
            pass

    context.user_data.clear()
    return ConversationHandler.END

async def cancel_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.effective_message.reply_text("❌ Action cancelled. Returning to main menu.", reply_markup=get_main_menu_keyboard())
    return ConversationHandler.END

# -----------------------------------------------------------------------------
# 10. REPORT ISSUE FLOW (CONVERSATION HANDLER)
# -----------------------------------------------------------------------------
async def start_report_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    chat = update.effective_chat
    if chat and chat.type in [constants.ChatType.GROUP, constants.ChatType.SUPERGROUP]:
        bot_username = context.bot.username or "Unicorngoods_bot"
        prompt = (
            "⚠️ <b>Report Broken File or Link</b>\n\n"
            "To submit an issue report privately without cluttering this group, please tap below to open our 1-on-1 private chat:"
        )
        buttons = [
            [InlineKeyboardButton("⚠️ Submit Report in DM ↗", url=f"https://t.me/{bot_username}?start=report")],
        ]
        if update.callback_query:
            await update.callback_query.answer()
        await update.effective_message.reply_text(
            prompt,
            parse_mode=constants.ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return ConversationHandler.END

    query = update.callback_query
    pid = ""
    if query and query.data.startswith("report_item:"):
        pid = query.data.split("report_item:")[1].strip()
        context.user_data["rep_pid"] = pid

    prompt = (
        "⚠️ <b>Report Broken File or Problem</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "👉 <b>Step 1/2:</b> What is the reason for your report?\n\n"
        "1️⃣ Broken or inaccessible download link\n"
        "2️⃣ Outdated or wrong material\n"
        "3️⃣ Corrupted file / password issue\n"
        "4️⃣ Other issue\n\n"
        "<i>(Select a button below or type your custom reason):</i>"
    )
    keyboard = [
        [InlineKeyboardButton("🔗 Broken Download Link", callback_data="rep_reason:Broken Link")],
        [InlineKeyboardButton("📦 Outdated / Wrong File", callback_data="rep_reason:Outdated File")],
        [InlineKeyboardButton("🔒 Corrupted / Password Issue", callback_data="rep_reason:Corrupted File")],
        [InlineKeyboardButton("❌ Cancel", callback_data="nav:menu")],
    ]

    if query:
        await query.edit_message_text(prompt, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))
    elif update.effective_message:
        await update.effective_message.reply_text(prompt, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))
    return REP_REASON

async def report_reason_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    reason = query.data.split("rep_reason:")[1]
    context.user_data["rep_reason"] = reason

    prompt = (
        f"📌 <b>Reason:</b> <code>{html.escape(reason)}</code>\n\n"
        "👉 <b>Step 2/2:</b> Please provide details or the name of the affected material:"
    )
    await query.edit_message_text(prompt, parse_mode=constants.ParseMode.HTML)
    return REP_DETAILS

async def report_reason_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["rep_reason"] = update.effective_message.text.strip()
    prompt = "👉 <b>Step 2/2:</b> Please provide specific details about what happened:"
    await update.effective_message.reply_text(prompt, parse_mode=constants.ParseMode.HTML)
    return REP_DETAILS

async def report_details_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    details = update.effective_message.text.strip()
    user = update.effective_user
    pid = context.user_data.get("rep_pid", "GENERAL")
    reason = context.user_data.get("rep_reason", "General Issue")

    # Fetch product title if pid exists
    prod_title = "General Report"
    if pid != "GENERAL":
        products = await FirebaseRTDB.get_all_products_raw()
        p = next((x for x in products if x.get("id") == pid), None)
        if p:
            prod_title = p.get("title", "Material")

    payload = {
        "productId": pid,
        "productTitle": prod_title,
        "userName": user.full_name or user.username or f"User_{user.id}",
        "reason": reason,
        "issue": details,
        "status": "pending",
        "adminReply": "",
        "timestamp": int(time.time() * 1000),
        "telegramUserId": user.id,
        "telegramUsername": f"@{user.username}" if user.username else "",
    }

    rep_id = await FirebaseRTDB.post("reports", payload)
    ticket_no = rep_id[-6:].upper() if rep_id else "REP-OK"

    confirm_text = (
        "🚨 <b>Issue Report Received!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🎫 <b>Ticket ID:</b> <code>#REP-{ticket_no}</code>\n"
        f"📦 <b>Material:</b> {html.escape(prod_title)}\n"
        f"📌 <b>Reason:</b> {html.escape(reason)}\n"
        f"📝 <b>Details:</b> {html.escape(details)}\n"
        f"⏳ <b>Status:</b> <code>Under Investigation</code>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "🙏 <i>Thank you for helping keep UNICORN GOODS clean and verified!</i>"
    )
    keyboard = [
        [InlineKeyboardButton("📋 My Reports Status", callback_data="nav:activity")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
    ]
    await update.effective_message.reply_text(confirm_text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup(keyboard))

    # Alert admins
    for admin_id in ADMIN_USER_IDS:
        try:
            alert = (
                f"🚨 <b>New Bug/Issue Report!</b>\n\n"
                f"Item: {html.escape(prod_title)}\n"
                f"Reason: {html.escape(reason)}\n"
                f"Issue: {html.escape(details)}\n"
                f"User: {html.escape(user.full_name)} ({payload['telegramUsername']})\n"
                f"Ticket: <code>#REP-{ticket_no}</code>"
            )
            await context.bot.send_message(chat_id=admin_id, text=alert, parse_mode=constants.ParseMode.HTML)
        except Exception:
            pass

    context.user_data.clear()
    return ConversationHandler.END

# -----------------------------------------------------------------------------
# 11. USER ACTIVITY, SAVED GOODS & ABOUT INFO
# -----------------------------------------------------------------------------
async def render_text_response(target, text: str, reply_markup=None) -> None:
    """Renders text response whether target is a CallbackQuery or a Message object."""
    if hasattr(target, "edit_message_text"):
        try:
            await target.edit_message_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=reply_markup)
            return
        except Exception:
            pass
    if hasattr(target, "reply_text"):
        await target.reply_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=reply_markup)
    elif hasattr(target, "message") and hasattr(target.message, "reply_text"):
        await target.message.reply_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=reply_markup)

async def show_user_activity(target, user_id: int) -> None:
    # 1. Fetch user requests
    raw_reqs = await FirebaseRTDB.get("requests") or {}
    user_reqs = []
    for rid, rdata in raw_reqs.items():
        if isinstance(rdata, dict) and rdata.get("telegramUserId") == user_id:
            rdata["id"] = rid
            user_reqs.append(rdata)
    user_reqs.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # 2. Fetch user reports
    raw_reps = await FirebaseRTDB.get("reports") or {}
    user_reps = []
    for rid, rdata in raw_reps.items():
        if isinstance(rdata, dict) and rdata.get("telegramUserId") == user_id:
            rdata["id"] = rid
            user_reps.append(rdata)
    user_reps.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    text = (
        "📋 <b>Your Activity & Request Status Tracker</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )

    if not user_reqs and not user_reps:
        text += (
            "<i>You haven't submitted any requests or reports yet.</i>\n\n"
            "💡 Use <b>➕ Request Item</b> to request any book, note, or tool!"
        )
    else:
        if user_reqs:
            text += "<b>📦 YOUR REQUESTS:</b>\n"
            for idx, r in enumerate(user_reqs[:5], start=1):
                status = r.get("status", "pending").lower()
                status_icon = "🟢" if status == "approved" else ("🔴" if status == "rejected" else "⏳")
                reply = r.get("adminReply", "").strip()
                text += (
                    f"<b>{idx}. {html.escape(r.get('itemName', 'Item'))}</b>\n"
                    f"   Status: {status_icon} <b>{status.upper()}</b>\n"
                )
                if reply:
                    text += f"   💬 <i>Admin: {html.escape(reply)}</i>\n"
                text += "\n"

        if user_reps:
            text += "<b>⚠️ YOUR REPORTS:</b>\n"
            for idx, rep in enumerate(user_reps[:5], start=1):
                status = rep.get("status", "pending").lower()
                status_icon = "🟢" if status in ["resolved", "approved"] else "⏳"
                text += (
                    f"<b>{idx}. {html.escape(rep.get('productTitle', 'Issue'))}</b>\n"
                    f"   Status: {status_icon} <b>{status.upper()}</b>\n"
                )
                if rep.get("adminReply"):
                    text += f"   💬 <i>Admin: {html.escape(rep['adminReply'])}</i>\n"
                text += "\n"

    keyboard = [
        [InlineKeyboardButton("➕ Submit New Request", callback_data="nav:request")],
        [InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")],
    ]
    await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(keyboard))

async def show_saved_goods(target, user_id: int) -> None:
    raw_saved = await FirebaseRTDB.get(f"bot_saved/{user_id}") or {}
    if not raw_saved:
        text = (
            "⭐ <b>Your Saved Goods</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "<i>You have no saved materials yet.</i>\n\n"
            "💡 When viewing any material, click the <b>⭐ Save</b> button to bookmark it here!"
        )
        keyboard = [
            [InlineKeyboardButton("📚 Browse Categories", callback_data="nav:categories")],
            [InlineKeyboardButton("🏠 Main Menu", callback_data="nav:menu")],
        ]
        await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    all_products = await FirebaseRTDB.get_all_products_raw()
    saved_items = [p for p in all_products if p.get("id") in raw_saved]

    text = (
        f"⭐ <b>Your Saved Goods ({len(saved_items)} items)</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )
    buttons = []
    for idx, p in enumerate(saved_items, start=1):
        title = p.get("title", "Untitled")
        cat = p.get("category", "General")
        text += f"<b>{idx}. {html.escape(title)}</b> <code>[{html.escape(cat)}]</code>\n"
        buttons.append([
            InlineKeyboardButton(f"📥 #{idx} {title[:28]}", callback_data=f"view_prod:{p['id']}")
        ])

    buttons.append([InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")])
    await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(buttons))

async def show_about_info(target) -> None:
    about = await FirebaseRTDB.get("settings/about") or {}
    branding = await FirebaseRTDB.get("settings/branding") or {}

    title = about.get("title") or branding.get("brandTitle") or "About UNICORN GOODS"
    tagline = about.get("tagline") or branding.get("brandTagline") or "Curated Free Digital Library"
    content = about.get("content", "A community-driven digital download library providing verified textbooks, lecture notes, APKs, and desktop utilities with high-speed direct downloads.")
    version = about.get("version", "v2.4.0")
    contact_link = about.get("contactLink") or REQUIRED_CHANNEL_URL
    contact_text = about.get("contactText") or "Join Community & Support ↗"

    text = (
        f"🦄 <b>{html.escape(title)}</b> [<code>{html.escape(version)}</code>]\n"
        f"✨ <i>{html.escape(tagline)}</i>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{html.escape(content)}\n\n"
        "⚡ <b>Key Features:</b>\n"
        "• Direct Cloud Links (No URL shorteners, no countdowns)\n"
        "• 100% Free & Verified materials\n"
        "• Community Requests & Reports actively monitored by admins\n\n"
        f"📢 <b>Official Channel:</b> {REQUIRED_CHANNEL}"
    )

    buttons = [
        [InlineKeyboardButton(contact_text, url=contact_link)],
        [InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")],
    ]
    await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(buttons))

async def show_announcements(target) -> None:
    popup = await FirebaseRTDB.get("settings/popup") or {}
    p_title = popup.get("title", "Announcement")
    p_msg = popup.get("message", "No announcements at this time. Stay tuned for updates!")
    p_link = popup.get("link", "").strip()
    p_link_text = popup.get("linkText", "Check It Out ↗").strip()

    text = (
        f"📢 <b>{html.escape(p_title)}</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{html.escape(p_msg)}\n"
    )

    buttons = []
    if p_link and p_link.startswith("http"):
        buttons.append([InlineKeyboardButton(p_link_text or "Explore Now ↗", url=p_link)])
    buttons.append([InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")])

    await render_text_response(target, text, reply_markup=InlineKeyboardMarkup(buttons))

async def search_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user
    msg = update.effective_message
    is_group = chat.type in [constants.ChatType.GROUP, constants.ChatType.SUPERGROUP]

    if not is_group:
        is_member = await check_channel_membership(user.id, context.bot)
        if not is_member:
            await send_fsub_prompt(update, context)
            return

    query_text = " ".join(context.args).strip() if context.args else ""
    if query_text:
        await execute_catalog_search(update, context, query_text, is_group=is_group)
    else:
        if is_group:
            text = (
                "🔍 <b>How to search in this group:</b>\n\n"
                "Type: <code>/search &lt;item name&gt;</code>\n"
                "<i>Example:</i> <code>/search CapCut</code> or <code>/search NEET Notes</code>"
            )
            await msg.reply_text(text, parse_mode=constants.ParseMode.HTML)
        else:
            text = (
                "🔍 <b>Universal Material Search</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                "Simply type ANY book, note, app or tool name directly into this chat!\n\n"
                "<i>Or search with:</i> <code>/search &lt;item name&gt;</code>\n\n"
                "⚡ <i>Go ahead and type whatever you are looking for!</i>"
            )
            await msg.reply_text(
                text,
                parse_mode=constants.ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")]])
            )

async def activity_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return
    await show_user_activity(update.effective_message, user.id)

async def saved_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return
    await show_saved_goods(update.effective_message, user.id)

async def about_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return
    await show_about_info(update.effective_message)

async def announcement_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return
    await show_announcements(update.effective_message)

# -----------------------------------------------------------------------------
# 12. GLOBAL CALLBACK QUERY DISPATCHER
# -----------------------------------------------------------------------------
async def callback_dispatcher(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    data = query.data
    user = query.from_user

    if data == "noop":
        await query.answer()
        return

    # Verify membership callback
    if data == "verify_membership":
        is_member = await check_channel_membership(user.id, context.bot)
        if is_member:
            await query.answer("🎉 Verification successful! Welcome to UNICORN GOODS.", show_alert=True)
            welcome_text = (
                f"👋 <b>Welcome, {html.escape(user.first_name or 'Friend')}!</b>\n\n"
                "🦄 <b>UNICORN GOODS — Main Menu</b>\n"
                "<i>Curated Free Digital Download Library & Study Hub</i>\n\n"
                "🔍 Type any book, note, APK or software name directly in chat to search!\n"
                "👇 Or choose a category below to explore:"
            )
            await query.edit_message_text(
                welcome_text,
                parse_mode=constants.ParseMode.HTML,
                reply_markup=get_main_menu_keyboard(),
            )
        else:
            try:
                await context.bot.get_chat_member(chat_id=REQUIRED_CHANNEL_ID, user_id=user.id)
            except Exception as e:
                err_str = str(e).lower()
                if "member list is inaccessible" in err_str or "admin" in err_str:
                    await query.answer(
                        "⚠️ Setup Alert: Bot ko channel @its_vivek_x_sakku me Administrator banayein taaki verification activate ho sake!",
                        show_alert=True,
                    )
                    return
            await query.answer("⚠️ You have not joined @its_vivek_x_sakku yet! Please join first.", show_alert=True)
        return

    # Force-subscribe check for all other actions
    is_member = await check_channel_membership(user.id, context.bot)
    if not is_member:
        await send_fsub_prompt(update, context)
        return

    # Navigation actions
    if data == "nav:menu" or data == "nav:categories":
        await query.answer()
        text = (
            "🦄 <b>UNICORN GOODS — Categories & Explorer</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "👇 <i>Select a category to browse high-speed direct downloads:</i>"
        )
        await query.edit_message_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=get_main_menu_keyboard())

    elif data.startswith("cat:"):
        await query.answer()
        category = data.split("cat:")[1]
        await render_category_page(query, category, 0, user.id)

    elif data.startswith("page:"):
        await query.answer()
        _, cat, page_str = data.split(":")
        await render_category_page(query, cat, int(page_str), user.id)

    elif data.startswith("view_prod:"):
        pid = data.split("view_prod:")[1]
        await show_product_detail(update, pid)

    elif data.startswith("save:"):
        pid = data.split("save:")[1]
        curr = await FirebaseRTDB.get(f"bot_saved/{user.id}/{pid}")
        if curr:
            await FirebaseRTDB.put(f"bot_saved/{user.id}/{pid}", None)
            await query.answer("Removed from your Saved Goods ⭐", show_alert=False)
        else:
            await FirebaseRTDB.put(f"bot_saved/{user.id}/{pid}", True)
            await query.answer("Saved to your Saved Goods ⭐! View anytime via /saved", show_alert=True)

    elif data == "nav:activity":
        await query.answer()
        await show_user_activity(query, user.id)

    elif data == "nav:saved":
        await query.answer()
        await show_saved_goods(query, user.id)

    elif data == "nav:about":
        await query.answer()
        await show_about_info(query)

    elif data == "nav:popup":
        await query.answer()
        await show_announcements(query)

    elif data == "nav:search":
        await query.answer()
        text = (
            "🔍 <b>Universal Material Search</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "Simply type ANY book, note, app or tool name directly into this chat!\n\n"
            "<i>Examples to try:</i>\n"
            "• <code>NEET PYQs</code>\n"
            "• <code>Capcut Pro</code>\n"
            "• <code>Vanced YT</code>\n"
            "• <code>Kinemaster</code>\n"
            "• <code>Vardaan Cinema</code>\n\n"
            "⚡ <i>Go ahead and type whatever you are looking for!</i>"
        )
        await query.edit_message_text(text, parse_mode=constants.ParseMode.HTML, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Back to Menu", callback_data="nav:menu")]]))

# -----------------------------------------------------------------------------
# 13. AUTOMATED LIVE NOTIFICATION BACKGROUND WORKER
# -----------------------------------------------------------------------------
async def notification_worker(app) -> None:
    """Runs continuously in the background to deliver real-time Telegram DMs to users when admins reply to requests/reports."""
    logger.info("Notification worker started.")
    await asyncio.sleep(10)

    while True:
        try:
            # 1. Check Requests for Status/Reply Updates
            requests_raw = await FirebaseRTDB.get("requests")
            if requests_raw and isinstance(requests_raw, dict):
                for rid, rdata in requests_raw.items():
                    if not isinstance(rdata, dict):
                        continue
                    tg_user_id = rdata.get("telegramUserId")
                    if not tg_user_id:
                        continue

                    status = rdata.get("status", "pending")
                    reply = rdata.get("adminReply", "").strip()
                    cache_key = f"{status}_{reply}"

                    # If status or reply changed from pending
                    if rid in NOTIFIED_REQUEST_STATUS:
                        if NOTIFIED_REQUEST_STATUS[rid] != cache_key and status != "pending":
                            NOTIFIED_REQUEST_STATUS[rid] = cache_key
                            # Send notification DM
                            msg = (
                                "🔔 <b>Update on your UNICORN GOODS Request!</b>\n"
                                "━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"📦 <b>Item:</b> {html.escape(rdata.get('itemName', 'Item'))}\n"
                                f"📌 <b>Status:</b> <b>{status.upper()}</b>\n"
                            )
                            if reply:
                                msg += f"💬 <b>Admin Note:</b> {html.escape(reply)}\n"
                            msg += (
                                "━━━━━━━━━━━━━━━━━━━━━━\n"
                                "💡 <i>Type the item name in chat anytime to download!</i>"
                            )
                            try:
                                await app.bot.send_message(chat_id=tg_user_id, text=msg, parse_mode=constants.ParseMode.HTML)
                            except Exception as e:
                                logger.debug(f"Failed sending request DM to {tg_user_id}: {e}")
                    else:
                        NOTIFIED_REQUEST_STATUS[rid] = cache_key

            # 2. Check Reports for Resolution Updates
            reports_raw = await FirebaseRTDB.get("reports")
            if reports_raw and isinstance(reports_raw, dict):
                for rid, rdata in reports_raw.items():
                    if not isinstance(rdata, dict):
                        continue
                    tg_user_id = rdata.get("telegramUserId")
                    if not tg_user_id:
                        continue

                    status = rdata.get("status", "pending")
                    reply = rdata.get("adminReply", "").strip()
                    cache_key = f"{status}_{reply}"

                    if rid in NOTIFIED_REPORT_STATUS:
                        if NOTIFIED_REPORT_STATUS[rid] != cache_key and status != "pending":
                            NOTIFIED_REPORT_STATUS[rid] = cache_key
                            msg = (
                                "✅ <b>Your UNICORN GOODS Report has been Resolved!</b>\n"
                                "━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"📦 <b>Material:</b> {html.escape(rdata.get('productTitle', 'Item'))}\n"
                                f"📌 <b>Status:</b> <b>{status.upper()}</b>\n"
                            )
                            if reply:
                                msg += f"💬 <b>Admin Resolution:</b> {html.escape(reply)}\n"
                            msg += "━━━━━━━━━━━━━━━━━━━━━━\n🙏 <i>Thank you for keeping our library verified!</i>"
                            try:
                                await app.bot.send_message(chat_id=tg_user_id, text=msg, parse_mode=constants.ParseMode.HTML)
                            except Exception as e:
                                logger.debug(f"Failed sending report DM to {tg_user_id}: {e}")
                    else:
                        NOTIFIED_REPORT_STATUS[rid] = cache_key

            # 3. Check for New Broadcasts in 'notifications' and notify all users
            notifs_raw = await FirebaseRTDB.get("notifications")
            if notifs_raw and isinstance(notifs_raw, dict):
                for nid, ndata in notifs_raw.items():
                    if not isinstance(ndata, dict):
                        continue
                    ts = ndata.get("timestamp", 0)
                    if nid not in NOTIFIED_BROADCAST_IDS:
                        NOTIFIED_BROADCAST_IDS.add(nid)
                        # Broadcast if created recently (within last 30 minutes or after bot start)
                        if ts > (BOT_START_TIME - 1800000):
                            b_msg = ndata.get("message", "").strip()
                            b_type = ndata.get("type", "info").upper()
                            type_icon = "📢" if b_type == "INFO" else ("🚨" if b_type == "ALERT" else "✨")
                            broadcast_card = (
                                f"{type_icon} <b>UNICORN GOODS OFFICIAL BROADCAST</b>\n"
                                "━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"{html.escape(b_msg)}\n"
                                "━━━━━━━━━━━━━━━━━━━━━━\n"
                                "⚡ <i>Direct update from UNICORN GOODS. Browse anytime below!</i>"
                            )
                            all_users = await FirebaseRTDB.get_all_bot_users()
                            for uid in all_users:
                                try:
                                    await app.bot.send_message(
                                        chat_id=uid,
                                        text=broadcast_card,
                                        parse_mode=constants.ParseMode.HTML,
                                        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🏠 Open Library", callback_data="nav:menu")]]),
                                    )
                                    await asyncio.sleep(0.05)
                                except Exception as e:
                                    logger.debug(f"Broadcast push failed for {uid}: {e}")

        except Exception as e:
            logger.debug(f"Worker iteration notice: {e}")

        await asyncio.sleep(25)

# -----------------------------------------------------------------------------
# 15. MAIN INITIALIZATION
# -----------------------------------------------------------------------------
def main() -> None:
    """Builds and starts the UNICORN GOODS Telegram bot application."""
    if not BOT_TOKEN or "AAHYV5pFGGXjpbjqv8ZdUqKslZDh7CBKqGk" not in BOT_TOKEN:
        logger.error("Invalid or missing BOT_TOKEN.")

    logger.info("Initializing UNICORN GOODS Telegram Bot...")

    application = ApplicationBuilder().token(BOT_TOKEN).build()

    # 1. Request Flow (ConversationHandler)
    request_conv = ConversationHandler(
        entry_points=[
            CommandHandler("request", start_request_flow),
            CallbackQueryHandler(start_request_flow, pattern="^nav:request$"),
            CallbackQueryHandler(start_request_flow, pattern="^req_prefill:"),
        ],
        states={
            REQ_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, request_name_received)],
            REQ_CATEGORY: [CallbackQueryHandler(request_cat_received, pattern="^req_cat:")],
            REQ_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, request_details_received)],
        },
        fallbacks=[CommandHandler("cancel", cancel_flow)],
        per_message=False,
    )

    # 2. Report Flow (ConversationHandler)
    report_conv = ConversationHandler(
        entry_points=[
            CommandHandler("report", start_report_flow),
            CallbackQueryHandler(start_report_flow, pattern="^report_item:"),
        ],
        states={
            REP_REASON: [
                CallbackQueryHandler(report_reason_button, pattern="^rep_reason:"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, report_reason_text),
            ],
            REP_DETAILS: [MessageHandler(filters.TEXT & ~filters.COMMAND, report_details_received)],
        },
        fallbacks=[CommandHandler("cancel", cancel_flow)],
        per_message=False,
    )

    # Register Conversation Handlers FIRST
    application.add_handler(request_conv)
    application.add_handler(report_conv)

    # Basic Commands
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("menu", start_command))
    application.add_handler(CommandHandler("search", search_command))
    application.add_handler(CommandHandler("activity", activity_command))
    application.add_handler(CommandHandler("saved", saved_command))
    application.add_handler(CommandHandler("about", about_command))
    application.add_handler(CommandHandler("announcement", announcement_command))
    application.add_handler(CommandHandler("announcements", announcement_command))
    application.add_handler(CommandHandler("help", help_command))

    # Callback Query Dispatcher
    application.add_handler(CallbackQueryHandler(callback_dispatcher))

    # Universal Text, Photo & Audio Message Handlers
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_user_text_search))
    application.add_handler(MessageHandler(filters.PHOTO, handle_user_photo))
    application.add_handler(MessageHandler(filters.VOICE | filters.AUDIO, handle_user_audio))

    # Start background notification worker and register Telegram Bot menu commands
    async def post_init(app):
        try:
            await app.bot.set_my_commands([
                BotCommand("start", "Open main menu & library"),
                BotCommand("menu", "Browse materials by category"),
                BotCommand("search", "Search books, notes, APKs & tools"),
                BotCommand("request", "Request missing study material or app"),
                BotCommand("report", "Report a broken link or issue"),
                BotCommand("activity", "Track your requests & admin replies"),
                BotCommand("saved", "View your bookmarked goods"),
                BotCommand("about", "About UNICORN GOODS & community"),
                BotCommand("announcement", "View latest updates & notices"),
                BotCommand("help", "Bot guide & command instructions"),
            ])
            logger.info("Bot commands successfully registered with Telegram API.")
        except Exception as e:
            logger.warning(f"Could not auto-register bot commands: {e}")
        asyncio.create_task(notification_worker(app))

    application.post_init = post_init

    logger.info("Bot is ready. Starting polling...")
    application.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
