// ============================================================
// CAMPUS MAINTENANCE PORTAL - app.js
// ============================================================

"use strict";


// ============================================================
// GLOBAL STATE
// ============================================================


let studentPollingTimer = null;

let adminUpdateInProgress = false;
let adminLoading = false;
let studentLoading = false;

/*
 * IMPORTANT:
 *
 * This becomes true whenever the admin is editing a request.
 * While true, admin polling is completely stopped.
 */
let adminEditing = false;


// ============================================================
// COMMON HELPERS
// ============================================================

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    try {

        const date = new Date(value);

        if (isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString();

    } catch (error) {

        return String(value);
    }
}


// ============================================================
// SAFE JSON HANDLER
// ============================================================

async function getJson(response) {

    if (
        response.redirected &&
        response.url &&
        response.url.includes("/login")
    ) {

        throw new Error(
            "Your session has expired. Please log in again."
        );
    }


    const text =
        await response.text();


    let data = {};


    if (text) {

        try {

            data = JSON.parse(text);

        } catch (error) {

            if (
                text.includes("<!DOCTYPE html>") ||
                text.includes("<html")
            ) {

                throw new Error(
                    `Server returned an HTML page instead of JSON (${response.status}).`
                );
            }

            throw new Error(
                `Server returned an invalid response (${response.status}).`
            );
        }
    }


    if (!response.ok) {

        throw new Error(
            data.error ||
            data.details ||
            `Request failed (${response.status})`
        );
    }


    return data;
}


// ============================================================
// LOGIN REDIRECT
// ============================================================

function redirectToLogin() {

    stopStudentPolling();

    window.location.href = "/login";
}

// ============================================================
// STUDENT REQUESTS
// ============================================================

async function loadStudentRequests() {

    const container =
        document.getElementById("studentRequests");


    if (!container) {
        return;
    }


    /*
     * Prevent duplicate requests.
     */

    if (studentLoading) {
        return;
    }


    studentLoading = true;


    try {

        const response = await fetch(
            "/api/student/requests",
            {
                method: "GET",

                headers: {
                    "Accept": "application/json",
                    "Cache-Control": "no-cache"
                },

                cache: "no-store"
            }
        );


        if (response.status === 401) {

            redirectToLogin();

            return;
        }


        const requests =
            await getJson(response);


        console.log(
            "STUDENT REQUESTS:",
            requests
        );


        if (!Array.isArray(requests)) {

            throw new Error(
                "Invalid request data received from server."
            );
        }


        renderStudentRequests(requests);


    } catch (error) {

        console.error(
            "STUDENT REQUEST ERROR:",
            error
        );


        const existingCards =
            container.querySelectorAll(
                ".request-card"
            );


        /*
         * Do not destroy valid cards because of
         * a temporary connection problem.
         */

        if (existingCards.length === 0) {

            container.innerHTML = `

                <div class="error-message">

                    <strong>
                        Unable to load your maintenance requests.
                    </strong>

                    <br><br>

                    <small>
                        ${escapeHtml(error.message)}
                    </small>

                    <br><br>

                    <button
                        type="button"
                        onclick="loadStudentRequests()"
                    >
                        Retry
                    </button>

                </div>

            `;
        }

    } finally {

        studentLoading = false;
    }
}


// ============================================================
// RENDER STUDENT REQUESTS
// ============================================================

function renderStudentRequests(requests) {

    const container =
        document.getElementById("studentRequests");


    if (!container) {
        return;
    }


    if (!Array.isArray(requests)) {

        container.innerHTML = `

            <div class="error-message">
                Invalid request data received from server.
            </div>

        `;

        return;
    }


    // ========================================================
    // STATISTICS
    // ========================================================

    const total =
        requests.length;


    const pending =
        requests.filter(
            r => r.status === "Pending"
        ).length;


    const active =
        requests.filter(
            r =>
                r.status === "Approved" ||
                r.status === "Assigned" ||
                r.status === "In Progress"
        ).length;


    const completed =
        requests.filter(
            r => r.status === "Completed"
        ).length;


    const totalElement =
        document.getElementById("studentTotal");


    const pendingElement =
        document.getElementById("studentPending");


    const activeElement =
        document.getElementById("studentActive");


    const completedElement =
        document.getElementById("studentCompleted");


    if (totalElement) {
        totalElement.textContent = total;
    }


    if (pendingElement) {
        pendingElement.textContent = pending;
    }


    if (activeElement) {
        activeElement.textContent = active;
    }


    if (completedElement) {
        completedElement.textContent = completed;
    }


    // ========================================================
    // NO REQUESTS
    // ========================================================

    if (requests.length === 0) {

        container.innerHTML = `

            <div class="empty">

                <h3>
                    No maintenance requests
                </h3>

                <p>
                    Submit your first campus maintenance request.
                </p>

            </div>

        `;

        return;
    }


    // ========================================================
    // REQUEST CARDS
    // ========================================================

    let html = "";


    requests.forEach((item) => {

        const status =
            item.status || "Pending";


        const statusClass =
            getStatusClass(status);


        html += `

            <article class="request-card">

                <div class="request-top">

                    <h3>
                        ${escapeHtml(item.title)}
                    </h3>


                    <span
                        class="status ${statusClass}"
                    >
                        ${escapeHtml(status)}
                    </span>

                </div>


                <p>
                    ${escapeHtml(item.description)}
                </p>


                <div class="meta">

                    <span>
                        <b>Category:</b>
                        ${escapeHtml(item.category)}
                    </span>


                    <span>
                        <b>Location:</b>
                        ${escapeHtml(item.location)}
                    </span>


                    <span>
                        <b>Assigned To:</b>
                        ${escapeHtml(
            item.assigned_to ||
            "Not assigned"
        )}
                    </span>

                </div>


                ${item.admin_comment
                ? `

                        <div class="comment">

                            <b>
                                Admin:
                            </b>

                            ${escapeHtml(
                    item.admin_comment
                )}

                        </div>

                    `
                : ""
            }


                <small>

                    Last updated:
                    ${escapeHtml(
                formatDate(item.updated_at)
            )}

                </small>

            </article>

        `;
    });


    container.innerHTML = html;
}


// ============================================================
// STATUS CLASS
// ============================================================

function getStatusClass(status) {

    switch (status) {

        case "Approved":
            return "status-approved";

        case "Assigned":
            return "status-assigned";

        case "In Progress":
            return "status-progress";

        case "Completed":
            return "status-completed";

        case "Rejected":
            return "status-rejected";

        case "Pending":
        default:
            return "status-pending";
    }
}


// ============================================================
// STUDENT POLLING
// ============================================================

function startStudentPolling() {

    stopStudentPolling();


    studentPollingTimer =
        setInterval(
            function () {

                loadStudentRequests();

            },
            3000
        );
}


function stopStudentPolling() {

    if (studentPollingTimer !== null) {

        clearInterval(
            studentPollingTimer
        );

        studentPollingTimer = null;
    }
}


// ============================================================
// ADMIN REQUESTS
// ============================================================

async function loadAdminRequests() {

    const tableBody =
        document.getElementById("adminRequests");


    if (!tableBody) {
        return;
    }


    /*
     * THIS IS THE MOST IMPORTANT PART.
     *
     * Never rebuild the admin table while the admin
     * is editing a request.
     */

    if (
        adminUpdateInProgress ||
        adminEditing
    ) {

        console.log(
            "ADMIN TABLE RELOAD SKIPPED - ADMIN IS EDITING"
        );

        return;
    }


    /*
     * Prevent overlapping GET requests.
     */

    if (adminLoading) {
        return;
    }


    adminLoading = true;


    try {

        const response = await fetch(
            "/api/admin/requests",
            {
                method: "GET",

                headers: {
                    "Accept": "application/json",
                    "Cache-Control": "no-cache"
                },

                cache: "no-store"
            }
        );


        console.log(
            "ADMIN API STATUS:",
            response.status
        );


        if (response.status === 401) {

            redirectToLogin();

            return;
        }


        if (response.status === 403) {

            throw new Error(
                "You do not have administrator permission."
            );
        }


        const requests =
            await getJson(response);


        console.log(
            "ADMIN REQUESTS:",
            requests
        );


        if (!Array.isArray(requests)) {

            throw new Error(
                "Invalid request data received from server."
            );
        }


        /*
         * Double-check before replacing the table.
         *
         * The admin may have started editing while
         * the request was being fetched.
         */

        if (
            adminEditing ||
            adminUpdateInProgress
        ) {

            console.log(
                "ADMIN RESPONSE IGNORED - ADMIN STARTED EDITING"
            );

            return;
        }


        renderAdminRequests(requests);


    } catch (error) {

        console.error(
            "ADMIN REQUESTS ERROR:",
            error
        );


        /*
         * Do not replace an existing table with an error
         * during a temporary network problem.
         */

        if (!adminEditing) {

            const rows =
                tableBody.querySelectorAll("tr");


            if (rows.length === 0) {

                tableBody.innerHTML = `

                    <tr>

                        <td
                            colspan="7"
                            style="
                                text-align:center;
                                padding:20px;
                            "
                        >

                            <strong>
                                Unable to load requests
                            </strong>

                            <br><br>

                            <small>
                                ${escapeHtml(error.message)}
                            </small>

                        </td>

                    </tr>

                `;
            }
        }

    } finally {

        adminLoading = false;
    }
}


// ============================================================
// RENDER ADMIN REQUESTS
// ============================================================

function renderAdminRequests(requests) {

    const tableBody =
        document.getElementById("adminRequests");


    if (!tableBody) {
        return;
    }


    if (!Array.isArray(requests)) {

        return;
    }


    if (requests.length === 0) {

        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    style="
                        text-align:center;
                        padding:25px;
                    "
                >
                    No maintenance requests found.
                </td>

            </tr>

        `;

        return;
    }


    let html = "";


    requests.forEach((item) => {

        const student =
            item.users || {};


        const studentName =
            student.name ||
            "Unknown Student";


        const studentEmail =
            student.email ||
            "";


        html += `

            <tr>

                <!-- STUDENT -->

                <td>

                    <strong>
                        ${escapeHtml(studentName)}
                    </strong>

                    <br>

                    <small>
                        ${escapeHtml(studentEmail)}
                    </small>

                </td>


                <!-- PROBLEM -->

                <td>

                    <strong>
                        ${escapeHtml(item.title)}
                    </strong>

                    <br>

                    <small>
                        ${escapeHtml(item.description)}
                    </small>

                    <br>

                    <small>
                        Category:
                        ${escapeHtml(item.category)}
                    </small>

                </td>


                <!-- LOCATION -->

                <td>

                    ${escapeHtml(item.location)}

                </td>


                <!-- STATUS -->

                <td>

                    <select
                        id="status-${item.id}"
                        class="request-status"
                        data-request-id="${item.id}"
                    >

                        ${createStatusOptions(
            item.status
        )}

                    </select>

                </td>


                <!-- ASSIGNED TEAM -->

                <td>

                    <select
                        id="assigned-${item.id}"
                        class="request-assignment"
                        data-request-id="${item.id}"
                    >

                        ${createTeamOptions(
            item.assigned_to
        )}

                    </select>

                </td>


                <!-- COMMENT -->

                <td>

                    <textarea
                        id="comment-${item.id}"
                        class="request-comment"
                        data-request-id="${item.id}"
                        rows="3"
                        placeholder="Admin comment..."
                    >${escapeHtml(
            item.admin_comment || ""
        )}</textarea>

                </td>


                <!-- SAVE -->

                <td>

                    <button
                        type="button"
                        class="update-button"
                        data-request-id="${item.id}"
                        onclick="saveAdminRequest(${item.id})"
                    >
                        Save
                    </button>

                </td>

            </tr>

        `;
    });


    tableBody.innerHTML = html;
}


// ============================================================
// STATUS OPTIONS
// ============================================================

function createStatusOptions(currentStatus) {

    const statuses = [

        "Pending",
        "Approved",
        "Assigned",
        "In Progress",
        "Completed",
        "Rejected"

    ];


    return statuses.map(
        function (status) {

            const selected =
                status === currentStatus
                    ? "selected"
                    : "";


            return `

                <option
                    value="${escapeHtml(status)}"
                    ${selected}
                >
                    ${escapeHtml(status)}
                </option>

            `;
        }
    ).join("");
}


// ============================================================
// TEAM OPTIONS
// ============================================================

function createTeamOptions(currentTeam) {

    const teams = [

        "Electrical Maintenance",
        "Plumbing Maintenance",
        "IT / Network Support",
        "Furniture Maintenance",
        "Cleaning Team",
        "Air Conditioning Team",
        "General Maintenance"

    ];


    let html = `

        <option value="">
            Not Assigned
        </option>

    `;


    teams.forEach(
        function (team) {

            const selected =
                team === currentTeam
                    ? "selected"
                    : "";


            html += `

                <option
                    value="${escapeHtml(team)}"
                    ${selected}
                >
                    ${escapeHtml(team)}
                </option>

            `;
        }
    );


    return html;
}


// ============================================================
// ADMIN EDITING CONTROL
// ============================================================

function beginAdminEditing() {

    if (!adminUpdateInProgress) {

        adminEditing = true;

        console.log(
            "ADMIN EDITING STARTED"
        );
    }
}



// ============================================================
// ADMIN SAVE
// ============================================================

async function saveAdminRequest(requestId) {

    if (adminUpdateInProgress) {

        return;
    }


    const statusElement =
        document.getElementById(
            `status-${requestId}`
        );


    const assignedElement =
        document.getElementById(
            `assigned-${requestId}`
        );


    const commentElement =
        document.getElementById(
            `comment-${requestId}`
        );


    if (
        !statusElement ||
        !assignedElement ||
        !commentElement
    ) {

        alert(
            "Unable to find the request fields."
        );

        return;
    }


    /*
     * READ THE VALUES BEFORE DISABLING ANYTHING.
     */

    const status =
        statusElement.value;


    const assignedTo =
        assignedElement.value.trim();


    const adminComment =
        commentElement.value.trim();


    console.log(
        "========================================"
    );

    console.log(
        "SAVING ADMIN REQUEST"
    );

    console.log(
        "REQUEST ID:",
        requestId
    );

    console.log(
        "STATUS:",
        status
    );

    console.log(
        "ASSIGNED TO:",
        assignedTo
    );

    console.log(
        "COMMENT:",
        adminComment
    );

    console.log(
        "========================================"
    );


    /*
     * Validate status.
     */

    const allowedStatuses = [

        "Pending",
        "Approved",
        "Assigned",
        "In Progress",
        "Completed",
        "Rejected"

    ];


    if (
        !allowedStatuses.includes(status)
    ) {

        alert(
            "Invalid status selected."
        );

        return;
    }


    /*
     * Team is required for Assigned/In Progress.
     */

    if (
        (
            status === "Assigned" ||
            status === "In Progress"
        ) &&
        !assignedTo
    ) {

        alert(
            "Please select a maintenance team."
        );

        return;
    }


    // ========================================================
    // LOCK EVERYTHING
    // ========================================================

    adminUpdateInProgress = true;

    adminEditing = true;




    const buttons =
        document.querySelectorAll(
            ".update-button"
        );


    buttons.forEach(
        function (button) {

            button.disabled = true;

        }
    );


    statusElement.disabled = true;
    assignedElement.disabled = true;
    commentElement.disabled = true;


    try {

        // ====================================================
        // SEND TO FLASK
        // ====================================================

        const response = await fetch(

            `/api/admin/request/${requestId}/update`,

            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    "Cache-Control":
                        "no-cache"

                },

                body: JSON.stringify({

                    status: status,

                    assigned_to:
                        assignedTo,

                    admin_comment:
                        adminComment

                }),

                cache: "no-store"

            }
        );


        console.log(
            "SAVE HTTP STATUS:",
            response.status
        );


        if (response.status === 401) {

            redirectToLogin();

            return;
        }


        const data =
            await getJson(response);


        console.log(
            "SAVE RESPONSE:",
            data
        );


        /*
         * The Flask server must return the updated
         * database record.
         */

        if (
            !data.request
        ) {

            throw new Error(
                "Server did not return the updated request."
            );
        }


        console.log(
            "DATABASE UPDATED REQUEST:",
            data.request
        );


        /*
         * IMPORTANT:
         *
         * Do not allow polling to rebuild the table yet.
         *
         * First unlock the state.
         */

        adminUpdateInProgress = false;

        adminEditing = false;

        adminLoading = false;


        // ====================================================
        // RELOAD FROM DATABASE
        // ====================================================

        await loadAdminRequests();


        // ====================================================
        // RESTART POLLING
        // ====================================================




        alert(
            "Request updated successfully."
        );


    } catch (error) {

        console.error(
            "SAVE ERROR:",
            error
        );


        alert(
            "Unable to save the request.\n\n" +
            error.message
        );


    } finally {

        /*
         * Always unlock controls.
         */

        adminUpdateInProgress = false;


        adminEditing = false;


        if (statusElement) {
            statusElement.disabled = false;
        }


        if (assignedElement) {
            assignedElement.disabled = false;
        }


        if (commentElement) {
            commentElement.disabled = false;
        }


        buttons.forEach(
            function (button) {

                button.disabled = false;

            }
        );


        /*
         * Restart polling.
         */


    }
}


// ============================================================
// ADMIN POLLING
// ============================================================



// ============================================================
// ADMIN EDIT EVENT LISTENERS
// ============================================================

function setupAdminEditingListeners() {

    const tableBody =
        document.getElementById(
            "adminRequests"
        );


    if (!tableBody) {
        return;
    }


    /*
     * When admin clicks/selects/types inside the table,
     * immediately stop polling.
     */

    tableBody.addEventListener(
        "focusin",
        function (event) {

            if (
                event.target.matches(
                    ".request-status, .request-assignment, .request-comment"
                )
            ) {

                beginAdminEditing();
            }

        }
    );


    /*
     * If the admin changes a field, definitely keep the
     * table locked from polling until Save is clicked.
     */

    tableBody.addEventListener(
        "change",
        function (event) {

            if (
                event.target.matches(
                    ".request-status, .request-assignment"
                )
            ) {

                beginAdminEditing();
            }

        }
    );


    tableBody.addEventListener(
        "input",
        function (event) {

            if (
                event.target.matches(
                    ".request-comment"
                )
            ) {

                beginAdminEditing();
            }

        }
    );

}


// ============================================================
// AUTO LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "Campus Maintenance Portal app.js loaded."
        );


        // ====================================================
        // STUDENT
        // ====================================================

        if (
            document.getElementById(
                "studentRequests"
            )
        ) {

            loadStudentRequests();

            startStudentPolling();
        }


        // ====================================================
        // ADMIN
        // ====================================================

        if (
            document.getElementById(
                "adminRequests"
            )
        ) {

            setupAdminEditingListeners();

            loadAdminRequests();
        }

    }
);


// ============================================================
// CLEANUP
// ============================================================

window.addEventListener(
    "beforeunload",
    function () {

        stopStudentPolling();

    }
);