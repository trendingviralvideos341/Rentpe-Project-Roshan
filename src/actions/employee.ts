'use server';

import prisma from "@/lib/prisma";
import { getSession, encryptPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { uploadToCloudinary } from "@/lib/upload";
import { logAuditEvent } from "@/lib/audit";
import { randomUUID } from "crypto";

// ── Helpers ──────────────────────────────────────────────
async function generateEoreqId(): Promise<string> {
    // EOREQ-101 is reserved for admin, real employees start at EOREQ-102
    const count = await prisma.employee.count();
    const num = 102 + count; // 102, 103, 104...
    return `EOREQ-${num}`;
}

function appendAudit(trailJson: string, action: string, actorId: string, actorName: string, note?: string) {
    let trail: any[];
    try { trail = JSON.parse(trailJson || "[]"); } catch { trail = []; }
    trail.push({ action, actorId, actorName, note: note || "", timestamp: new Date().toISOString() });
    return JSON.stringify(trail);
}

async function autoProvisionAdminUser(emp: any, sessionUserId: string) {
    const existingUser = await prisma.user.findUnique({ where: { email: emp.email } });
    if (!existingUser) {
        const hashedPassword = await encryptPassword("Rentpe@123");

        // Count existing admins for ID generation
        const count = await prisma.user.count({ where: { role: 'ADMIN' } });
        const seq = String(count + 1).padStart(6, '0');
        const displayId = `ADM-${seq}`;

        await prisma.user.create({
            data: {
                name: emp.name,
                email: emp.email,
                passwordHash: hashedPassword,
                role: "ADMIN",
                roles: ["ADMIN"],
                isAdmin: true,
                displayId,
            }
        });

        logAuditEvent({
            actorId: sessionUserId,
            actorRole: 'ADMIN',
            actorName: 'Admin',
            actionType: 'CREATE',
            entityType: 'USER',
            entityId: emp.id,
            description: `Auto-provisioned login account (Rentpe@123)`,
        });
    }
}

// ── GET ──────────────────────────────────────────────────
import { requirePermission } from "@/actions/rbac";

export async function getEmployees() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');
    return prisma.employee.findMany({ orderBy: { addedOn: 'desc' } });
}

export async function getEmployee(id: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');
    return prisma.employee.findUnique({ where: { id } });
}

export async function getActiveEmployees() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');
    return prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, displayId: true, empCode: true, name: true, email: true, phone: true, department: true, designation: true, permissions: true },
        orderBy: { name: 'asc' }
    });
}

// ── CREATE ───────────────────────────────────────────────
export async function addEmployee(data: {
    name: string; email: string; phone: string;
    dateOfBirth?: string; gender?: string;
    permanentAddress?: string; currentAddress?: string;
    emergencyContactName?: string; emergencyContactPhone?: string; emergencyContactRel?: string;
    department: string; designation: string; permissions: string[];
    joiningDate?: string; salary?: number; employmentType?: string;
    aadhaarNumber?: string; panNumber?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const auditTrail = appendAudit("[]", "EMPLOYEE_ADDED", (session as any).userId, (session as any).name || "Admin", "Employee record created");

    const emp = await prisma.employee.create({
        data: {
            displayId: await generateEoreqId(),
            name: data.name,
            email: data.email,
            phone: data.phone,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            permanentAddress: data.permanentAddress,
            currentAddress: data.currentAddress,
            emergencyContactName: data.emergencyContactName,
            emergencyContactPhone: data.emergencyContactPhone,
            emergencyContactRel: data.emergencyContactRel,
            department: data.department,
            designation: data.designation,
            permissions: JSON.stringify(data.permissions),
            joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
            salary: data.salary,
            employmentType: data.employmentType || "FULL_TIME",
            status: "PENDING_DOCS",
            auditTrail,
            addedById: (session as any).userId,
        }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'CREATE',
        entityType: 'EMPLOYEE',
        entityId: emp.id,
        description: `${emp.name} — ${emp.department} / ${emp.designation}`,
    });

    revalidatePath('/dashboard/admin/employees');
    return emp;
}

// ── UPDATE STATUS ────────────────────────────────────────
export async function updateEmployeeStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'REJECTED', reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");

    const auditTrail = appendAudit(
        existing.auditTrail, `STATUS_${status}`,
        (session as any).userId, (session as any).name || "Admin", reason
    );

    const updateData: any = { status, auditTrail };
    if (status === 'SUSPENDED') updateData.suspensionReason = reason;
    if (status === 'TERMINATED') updateData.terminatedReason = reason;
    if (status === 'REJECTED') updateData.rejectedReason = reason;

    if (status === 'ACTIVE') {
        await autoProvisionAdminUser(existing, (session as any).userId);
    }

    const emp = await prisma.employee.update({ where: { id }, data: updateData });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: status === 'ACTIVE' ? 'APPROVE' : (status === 'REJECTED' ? 'REJECT' : 'UPDATE'),
        entityType: 'EMPLOYEE',
        entityId: id,
        description: reason,
    });

    revalidatePath('/dashboard/admin/employees');
    return emp;
}

// ── ACTIVATE ─────────────────────────────────────────────
export async function activateEmployee(id: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");

    const auditTrail = appendAudit(existing.auditTrail, "ACTIVATED", (session as any).userId, (session as any).name || "Admin", "Employee activated");

    await autoProvisionAdminUser(existing, (session as any).userId);

    const emp = await prisma.employee.update({
        where: { id },
        data: { status: "ACTIVE", auditTrail }
    });

    revalidatePath('/dashboard/admin/employees');
    return emp;
}

// ── UPLOAD DOCUMENT ──────────────────────────────────────
// Maps the short docField name → actual Prisma schema field names
const DOC_FIELD_MAP: Record<string, { dataField: string; nameField: string }> = {
    aadhaar: { dataField: 'aadhaarDoc', nameField: 'aadhaarName' },
    pan: { dataField: 'panDoc', nameField: 'panName' },
    photo: { dataField: 'photo', nameField: 'photoName' },
    address: { dataField: 'addressProof', nameField: 'addressProofName' },
    education: { dataField: 'educationCert', nameField: 'educationCertName' },
    experienceLetter: { dataField: 'experienceLetter', nameField: 'experienceLetterName' },
    policeVerification: { dataField: 'policeVerification', nameField: 'policeVerificationName' },
};

export async function uploadEmployeeDoc(id: string, docField: string, docData: string | File, docName: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");

    const fieldMap = DOC_FIELD_MAP[docField];
    if (!fieldMap) throw new Error(`Unknown document field: ${docField}`);

    const auditTrail = appendAudit(existing.auditTrail, "DOC_UPLOADED", (session as any).userId, (session as any).name || "Admin", `Uploaded: ${docField} — ${docName}`);

    // Security & Reliability Polish
    if (docData instanceof File) {
        if (!docData.type.startsWith('image/') && !docData.type.includes('pdf')) {
            throw new Error("Invalid file type: Only images and PDFs allowed.");
        }
        if (docData.size > 25 * 1024 * 1024) throw new Error("File size exceeds 25MB limit.");
    }

    // 1. Upload to Cloudinary with private access
    const folder = `employees/${id}_${randomUUID().slice(0, 8)}/${docField}`;
    const cloudUrl = await uploadToCloudinary(docData, folder, true);

    const updateData: any = { auditTrail };
    updateData[fieldMap.dataField] = cloudUrl;
    updateData[fieldMap.nameField] = docName;

    const emp = await prisma.employee.update({ where: { id }, data: updateData });
    revalidatePath('/dashboard/admin/employees');
    return emp;
}

// ── VERIFY DOCUMENT ──────────────────────────────────────
export async function verifyEmployeeDoc(id: string, docType: 'aadhaar' | 'pan' | 'education' | 'address' | 'police') {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");

    const auditTrail = appendAudit(existing.auditTrail, "DOC_VERIFIED", (session as any).userId, (session as any).name || "Admin", `Verified: ${docType}`);

    const updateData: any = { auditTrail };
    updateData[`${docType}Verified`] = true;

    // Check if all docs verified → auto-advance to BACKGROUND_CHECK
    const verifiedFields = {
        aadhaarVerified: docType === 'aadhaar' ? true : existing.aadhaarVerified,
        panVerified: docType === 'pan' ? true : existing.panVerified,
        addressVerified: docType === 'address' ? true : existing.addressVerified,
    };
    const allCoreVerified = verifiedFields.aadhaarVerified && verifiedFields.panVerified && verifiedFields.addressVerified;
    if (allCoreVerified && existing.status === "PENDING_DOCS") {
        updateData.status = "BACKGROUND_CHECK";
        appendAudit(auditTrail, "AUTO_ADVANCED", (session as any).userId, "System", "All core docs verified → Background check stage");
    }

    const emp = await prisma.employee.update({ where: { id }, data: updateData });
    revalidatePath('/dashboard/admin/employees');
    return emp;
}

// ── BACKGROUND CHECK ─────────────────────────────────────
export async function updateBackgroundCheck(id: string, status: 'IN_PROGRESS' | 'CLEARED' | 'FLAGGED', notes: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");

    const auditTrail = appendAudit(
        existing.auditTrail, `BG_CHECK_${status}`,
        (session as any).userId, (session as any).name || "Admin", notes
    );

    const emp = await prisma.employee.update({
        where: { id },
        data: {
            backgroundCheckStatus: status,
            backgroundCheckNotes: notes,
            backgroundCheckedAt: new Date(),
            auditTrail
        }
    });

    revalidatePath('/dashboard/admin/employees');
    return emp;
}

// ── UPDATE PERMISSIONS ────────────────────────────────────
export async function updateEmployeePermissions(id: string, permissions: string[], department: string, designation: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");

    const auditTrail = appendAudit(existing.auditTrail, "PERMISSIONS_UPDATED", (session as any).userId, (session as any).name || "Admin");

    const emp = await prisma.employee.update({
        where: { id },
        data: { permissions: JSON.stringify(permissions), department, designation, auditTrail }
    });

    revalidatePath('/dashboard/admin/employees');
    return emp;
}
// ── GENERATE EMPLOYEE CODE (after activation) ────────────
export async function generateEmpCode(id: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");
    if (existing.empCode) throw new Error("Employee code already assigned: " + existing.empCode);
    if (existing.status !== 'ACTIVE') throw new Error("Employee must be ACTIVE to generate a code");

    // Find the current highest code number
    const employeesWithCodes = await prisma.employee.findMany({
        where: { empCode: { not: null } },
        select: { empCode: true }
    });

    let maxNum = 101; // Start from 101 (Admin)
    employeesWithCodes.forEach(e => {
        const num = parseInt(e.empCode!.replace("EMP", ""));
        if (!isNaN(num) && num > maxNum) maxNum = num;
    });

    const newCode = `EMP${maxNum + 1}`;

    const auditTrail = appendAudit(existing.auditTrail, "EMP_CODE_GENERATED",
        (session as any).userId, (session as any).name || "Admin",
        `System assigned: ${newCode}`);

    const emp = await prisma.employee.update({
        where: { id },
        data: { empCode: newCode, auditTrail }
    });
    revalidatePath('/dashboard/admin/employees');
    return emp;
}

// ── EDIT EMPLOYEE CODE MANUALLY ────────────────────────────
export async function editEmpCode(id: string, newCode: string, notes: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');
    if (!notes.trim()) throw new Error("Notes are mandatory when manually editing employee code");
    if (!/^EMP\d{3,}$/.test(newCode.trim())) throw new Error("Code must be in format EMP101, EMP102 etc.");

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");

    // Check uniqueness
    const conflict = await prisma.employee.findFirst({ where: { empCode: newCode.trim(), id: { not: id } } });
    if (conflict) throw new Error(`Code ${newCode} is already assigned to ${conflict.name}`);

    const auditTrail = appendAudit(existing.auditTrail, "EMP_CODE_MANUAL_EDIT",
        (session as any).userId, (session as any).name || "Admin",
        `Changed from ${existing.empCode || 'none'} to ${newCode} — ${notes}`);

    const emp = await prisma.employee.update({
        where: { id },
        data: { empCode: newCode.trim(), empCodeNotes: notes.trim(), auditTrail }
    });
    revalidatePath('/dashboard/admin/employees');
    return emp;
}

// ── UNSUSPEND EMPLOYEE ────────────────────────────────────
export async function unsuspendEmployee(id: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');
    if (!reason.trim()) throw new Error("Reason is mandatory to unsuspend");

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new Error("Employee not found");
    if (existing.status !== 'SUSPENDED') throw new Error("Employee is not suspended");

    const auditTrail = appendAudit(existing.auditTrail, "UNSUSPENDED",
        (session as any).userId, (session as any).name || "Admin", reason);

    const emp = await prisma.employee.update({
        where: { id },
        data: { status: "ACTIVE", suspensionReason: null, auditTrail }
    });
    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'EMPLOYEE',
        entityId: id,
        description: reason,
    });
    revalidatePath('/dashboard/admin/employees');
    return emp;
}
