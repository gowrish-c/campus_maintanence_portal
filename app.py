import os
from datetime import datetime, timezone
from functools import wraps

from dotenv import load_dotenv
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    jsonify,
    flash,
)
from werkzeug.security import generate_password_hash, check_password_hash
from supabase import create_client, Client


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()


# ============================================================
# FLASK APP
# ============================================================

app = Flask(__name__)

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "change-this-secret-key"
)


# ============================================================
# SUPABASE CONFIGURATION
# ============================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_KEY")

if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL environment variable is required."
    )

if not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_SECRET_KEY environment variable is required."
    )


supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


# ============================================================
# CURRENT USER
# ============================================================

def current_user():

    user_id = session.get("user_id")

    if not user_id:
        return None

    try:

        result = (
            supabase
            .table("users")
            .select("id,name,email,role")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )

        if result.data:
            return result.data[0]

        return None

    except Exception as exc:

        print("=" * 60)
        print("CURRENT USER / SUPABASE ERROR")
        print(repr(exc))
        print("=" * 60)

        # Do not immediately log the user out when
        # Supabase temporarily has a connection problem.

        return {
            "id": user_id,
            "name": session.get("user_name", ""),
            "email": session.get("user_email", ""),
            "role": session.get("role", "student")
        }


# ============================================================
# LOGIN REQUIRED
# ============================================================

def login_required(view):

    @wraps(view)
    def wrapped(*args, **kwargs):

        if not session.get("user_id"):
            return redirect(url_for("login"))

        return view(*args, **kwargs)

    return wrapped


# ============================================================
# ROLE REQUIRED
# ============================================================

def role_required(role):

    def decorator(view):

        @wraps(view)
        def wrapped(*args, **kwargs):

            user = current_user()

            if not user:

                session.clear()

                return redirect(
                    url_for("login")
                )

            if user.get("role") != role:

                flash(
                    "You are not authorized to access that page.",
                    "danger"
                )

                return redirect(
                    url_for("dashboard")
                )

            return view(*args, **kwargs)

        return wrapped

    return decorator


# ============================================================
# MAKE USER AVAILABLE TO TEMPLATES
# ============================================================

@app.context_processor
def inject_user():

    return {
        "current_user": current_user()
    }


# ============================================================
# HOME
# ============================================================

@app.route("/")
def index():

    if session.get("user_id"):

        return redirect(
            url_for("dashboard")
        )

    return render_template(
        "index.html"
    )


# ============================================================
# REGISTER
# ============================================================

@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":

        name = request.form.get(
            "name",
            ""
        ).strip()

        email = request.form.get(
            "email",
            ""
        ).strip().lower()

        password = request.form.get(
            "password",
            ""
        )

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not name or not email or not password:

            flash(
                "All fields are required.",
                "danger"
            )

            return render_template(
                "register.html"
            )

        if len(password) < 6:

            flash(
                "Password must contain at least 6 characters.",
                "danger"
            )

            return render_template(
                "register.html"
            )

        # ----------------------------------------------------
        # CHECK EXISTING USER
        # ----------------------------------------------------

        try:

            existing = (
                supabase
                .table("users")
                .select("id")
                .eq("email", email)
                .limit(1)
                .execute()
            )

            print(
                "EXISTING USER CHECK:",
                existing.data
            )

        except Exception as exc:

            print(
                "EXISTING USER CHECK ERROR:",
                repr(exc)
            )

            flash(
                "Database error while checking the account. "
                "Check the VS Code terminal.",
                "danger"
            )

            return render_template(
                "register.html"
            )

        if existing.data:

            flash(
                "An account with this email already exists.",
                "danger"
            )

            return render_template(
                "register.html"
            )

        # ----------------------------------------------------
        # HASH PASSWORD
        # ----------------------------------------------------

        password_hash = generate_password_hash(
            password
        )

        # ----------------------------------------------------
        # CREATE USER
        # ----------------------------------------------------

        try:

            result = (
                supabase
                .table("users")
                .insert({
                    "name": name,
                    "email": email,
                    "password": password_hash,
                    "role": "student"
                })
                .execute()
            )

            print(
                "REGISTRATION RESULT:",
                result
            )

            print(
                "REGISTERED USER:",
                result.data
            )

        except Exception as exc:

            print(
                "REGISTRATION ERROR:",
                repr(exc)
            )

            flash(
                "Unable to create account. "
                "Check the VS Code terminal for the exact error.",
                "danger"
            )

            return render_template(
                "register.html"
            )

        # ----------------------------------------------------
        # SUCCESS
        # ----------------------------------------------------

        flash(
            "Registration successful. Please log in.",
            "success"
        )

        return redirect(
            url_for("login")
        )

    return render_template(
        "register.html"
    )


# ============================================================
# LOGIN
# ============================================================

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        email = request.form.get(
            "email",
            ""
        ).strip().lower()

        password = request.form.get(
            "password",
            ""
        )

        if not email or not password:

            flash(
                "Email and password are required.",
                "danger"
            )

            return render_template(
                "login.html"
            )

        try:

            result = (
                supabase
                .table("users")
                .select("*")
                .eq("email", email)
                .limit(1)
                .execute()
            )

            print(
                "LOGIN DATABASE RESULT:",
                result.data
            )

        except Exception as exc:

            print(
                "LOGIN DATABASE ERROR:",
                repr(exc)
            )

            flash(
                "Database connection error. "
                "Check the VS Code terminal.",
                "danger"
            )

            return render_template(
                "login.html"
            )

        user = (
            result.data[0]
            if result.data
            else None
        )

        if (
            not user
            or not check_password_hash(
                user["password"],
                password
            )
        ):

            flash(
                "Invalid email or password.",
                "danger"
            )

            return render_template(
                "login.html"
            )

        # ----------------------------------------------------
        # CREATE SESSION
        # ----------------------------------------------------

        session.clear()

        session["user_id"] = user["id"]
        session["role"] = user["role"]
        session["user_name"] = user["name"]
        session["user_email"] = user["email"]

        return redirect(
            url_for("dashboard")
        )

    return render_template(
        "login.html"
    )


# ============================================================
# LOGOUT
# ============================================================

@app.route("/logout")
def logout():

    session.clear()

    return redirect(
        url_for("index")
    )


# ============================================================
# DASHBOARD
# ============================================================

@app.route("/dashboard")
@login_required
def dashboard():

    user = current_user()

    if not user:

        session.clear()

        return redirect(
            url_for("login")
        )

    if user["role"] == "admin":

        return redirect(
            url_for("admin_dashboard")
        )

    return redirect(
        url_for("student_dashboard")
    )


# ============================================================
# STUDENT DASHBOARD
# ============================================================

@app.route("/student/dashboard")
@role_required("student")
def student_dashboard():

    return render_template(
        "student_dashboard.html"
    )


# ============================================================
# CREATE MAINTENANCE REQUEST
# ============================================================

@app.route(
    "/student/request/new",
    methods=["GET", "POST"]
)
@role_required("student")
def create_request():

    if request.method == "POST":

        title = request.form.get(
            "title",
            ""
        ).strip()

        description = request.form.get(
            "description",
            ""
        ).strip()

        category = request.form.get(
            "category",
            ""
        ).strip()

        location = request.form.get(
            "location",
            ""
        ).strip()

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not all([
            title,
            description,
            category,
            location
        ]):

            flash(
                "Please fill in all fields.",
                "danger"
            )

            return render_template(
                "create_request.html"
            )

        # ----------------------------------------------------
        # INSERT REQUEST
        # ----------------------------------------------------

        try:

            result = (
                supabase
                .table("maintenance_requests")
                .insert({
                    "student_id": session["user_id"],
                    "title": title,
                    "description": description,
                    "category": category,
                    "location": location,
                    "status": "Pending"
                })
                .execute()
            )

            print(
                "MAINTENANCE REQUEST RESULT:",
                result.data
            )

        except Exception as exc:

            print(
                "MAINTENANCE REQUEST ERROR:",
                repr(exc)
            )

            flash(
                "Unable to submit maintenance request. "
                "Check the VS Code terminal.",
                "danger"
            )

            return render_template(
                "create_request.html"
            )

        flash(
            "Maintenance request submitted successfully.",
            "success"
        )

        return redirect(
            url_for("student_dashboard")
        )

    return render_template(
        "create_request.html"
    )


# ============================================================
# ADMIN DASHBOARD
# ============================================================

@app.route("/admin/dashboard")
@role_required("admin")
def admin_dashboard():

    return render_template(
        "admin_dashboard.html"
    )


# ============================================================
# STUDENT REQUEST API
# ============================================================

@app.route("/api/student/requests", methods=["GET"])
@role_required("student")
def student_requests_api():
    print("=" * 70)
    print("STUDENT REQUESTS API")

    try:
        user = current_user()

        if not user:
            print("NO CURRENT USER")
            return jsonify({
                "error": "Not logged in."
            }), 401

        student_id = user.get("id")

        print("STUDENT ID:", student_id)

        if not student_id:
            return jsonify({
                "error": "Student ID not found."
            }), 400

        result = (
            supabase
            .table("maintenance_requests")
            .select(
                "id,"
                "title,"
                "description,"
                "category,"
                "location,"
                "status,"
                "assigned_to,"
                "admin_comment,"
                "created_at,"
                "updated_at"
            )
            .eq("student_id", student_id)
            .order("created_at", desc=True)
            .execute()
        )

        print("STUDENT REQUESTS RESULT:")
        print(result.data)

        return jsonify(result.data or [])

    except Exception as exc:
        print("=" * 70)
        print("STUDENT REQUESTS ERROR:")
        print(repr(exc))
        print("=" * 70)

        return jsonify({
            "error": "Unable to load student requests.",
            "details": str(exc)
        }), 500
# ============================================================
# ADMIN REQUEST API
# ============================================================

@app.route("/api/admin/requests")
@role_required("admin")
def admin_requests_api():

    try:

        result = (
            supabase
            .table("maintenance_requests")
            .select(
                "id,"
                "title,"
                "description,"
                "category,"
                "location,"
                "status,"
                "admin_comment,"
                "created_at,"
                "updated_at,"
                "student_id,"
                "assigned_to,"
                "users!maintenance_student_fk(name,email)"
            )
            .order(
                "created_at",
                desc=True
            )
            .execute()
        )

        print("ADMIN REQUESTS RESULT:")
        print(result.data)

        return jsonify(
            result.data
        )

    except Exception as exc:

        print("ADMIN REQUESTS ERROR:")
        print(repr(exc))

        return jsonify({
            "error": "Unable to load admin requests.",
            "details": str(exc)
        }), 500


# ============================================================
# UPDATE MAINTENANCE REQUEST
# ============================================================

@app.route(
    "/api/admin/request/<int:request_id>/update",
    methods=["POST"]
)
@role_required("admin")
def update_request(request_id):

    print("=" * 70)
    print("ADMIN UPDATE REQUEST")
    print("REQUEST ID:", request_id)

    try:

        data = request.get_json(silent=True)

        print("RECEIVED JSON:")
        print(data)

        if not data:
            return jsonify({
                "success": False,
                "error": "No update data received."
            }), 400


        status = (
            data.get("status") or ""
        ).strip()


        assigned_to = (
            data.get("assigned_to") or ""
        ).strip()


        admin_comment = (
            data.get("admin_comment") or ""
        ).strip()


        print("STATUS:", status)
        print("ASSIGNED TO:", assigned_to)
        print("COMMENT:", admin_comment)


        allowed_statuses = {
            "Pending",
            "Approved",
            "Assigned",
            "In Progress",
            "Completed",
            "Rejected"
        }


        if status not in allowed_statuses:

            return jsonify({
                "success": False,
                "error": "Invalid status."
            }), 400


       

        if (
            status in {
                "Assigned",
                "In Progress"
            }
            and not assigned_to
        ):

            return jsonify({
                "success": False,
                "error": "Please select a maintenance team."
            }), 400


        payload = {

            "status": status,

            "assigned_to":
                assigned_to if assigned_to else None,

            "admin_comment":
                admin_comment,

            "updated_at":
                datetime.now(
                    timezone.utc
                ).isoformat()

        }


        print("DATABASE PAYLOAD:")
        print(payload)


        result = (
            supabase
            .table("maintenance_requests")
            .update(payload)
            .eq("id", request_id)
            .execute()
        )


        print("SUPABASE UPDATE RESULT:")
        print(result.data)


        # ----------------------------------------------------
        # VERIFY
        # ----------------------------------------------------

        verify = (
            supabase
            .table("maintenance_requests")
            .select(
                "id,"
                "title,"
                "description,"
                "category,"
                "location,"
                "status,"
                "assigned_to,"
                "admin_comment,"
                "created_at,"
                "updated_at"
            )
            .eq("id", request_id)
            .limit(1)
            .execute()
        )


        print("VERIFIED DATABASE RECORD:")
        print(verify.data)


        if not verify.data:

            return jsonify({
                "success": False,
                "error": "Request was not found after update."
            }), 404


        updated_request =verify.data[0]


        if updated_request["status"] != status:

            return jsonify({
                "success": False,
                "error": (
                    "Database status does not match "
                    "the requested status."
                ),
                "request": updated_request
            }), 500


        print(
            "SUCCESS: REQUEST UPDATED CORRECTLY"
        )

        print("=" * 70)


        return jsonify({

            "success": True,

            "message":
                "Request updated successfully.",

            "request":
                updated_request

        })


    except Exception as exc:

        print("=" * 70)
        print("ADMIN UPDATE ERROR:")
        print(repr(exc))
        print("=" * 70)


        return jsonify({

            "success": False,

            "error":
                "Unable to update request.",

            "details":
                str(exc)

        }), 500

# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health")
def health():

    try:

        result = (
            supabase
            .table("users")
            .select("id")
            .limit(1)
            .execute()
        )

        print(
            "HEALTH CHECK:",
            result.data
        )

        return jsonify({
            "status": "ok",
            "database": "connected"
        })

    except Exception as exc:

        print(
            "HEALTH CHECK ERROR:",
            repr(exc)
        )

        return jsonify({
            "status": "error",
            "database": str(exc)
        }), 500


# ============================================================
# 404 ERROR
# ============================================================

@app.errorhandler(404)
def page_not_found(error):

    if request.path.startswith("/api/"):

        return jsonify({
            "error": "API endpoint not found."
        }), 404

    return render_template(
        "index.html"
    ), 404


# ============================================================
# 500 ERROR
# ============================================================

@app.errorhandler(500)
def internal_server_error(error):

    print(
        "INTERNAL SERVER ERROR:",
        repr(error)
    )

    if request.path.startswith("/api/"):

        return jsonify({
            "error": "Internal server error."
        }), 500

    return (
        "Internal Server Error",
        500
    )


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("CAMPUS MAINTENANCE PORTAL")
    print("=" * 60)

    print(
        "Supabase URL:",
        SUPABASE_URL
    )

    print(
        "Supabase secret key loaded:",
        bool(SUPABASE_KEY)
    )

    print(
        "Starting Flask server..."
    )

    print("=" * 60)

    app.run(
        host="0.0.0.0",
        port=int(
            os.environ.get(
                "PORT",
                5000
            )
        ),
        debug=True
    )