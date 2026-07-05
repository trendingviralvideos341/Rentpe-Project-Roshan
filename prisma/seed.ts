import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding RentPe database...\n");

    // ─── Step 1: Ensure Users Exist (Upsert) ────────────────

    // ─── Create Users ────────────────────────────────
    const adminPassword = await hash("RentPeAdmin@2026", 10);
    const ownerPassword = await hash("owner123", 10);
    const studentPassword = await hash("student123", 10);

    const admin = await prisma.user.upsert({
        where: { email: "admin@rentpe.in" },
        update: {},
        create: {
            email: "admin@rentpe.in",
            passwordHash: adminPassword,
            role: "ADMIN",
            roles: ["ADMIN"],
            isAdmin: true,
            adminRole: "SUPER_ADMIN",
            name: "RentPe Admin",
            phone: "9000000001",
            status: "ACTIVE",
            emailVerified: true,
            adminProfile: {
                create: {
                    displayId: "ADM-EMP-0001",
                    name: "RentPe Admin",
                    email: "admin@rentpe.in",
                    phone: "9000000001",
                    department: "System Administration",
                    role: "Super Admin",
                    permissions: JSON.stringify(["all"]),
                    status: "ACTIVE"
                }
            }
        }
    });
    console.log("✅ Admin (upserted):", admin.email);

    const adminStaffPassword = await hash("RentPeStaff@2026", 10);
    const adminStaff = await prisma.user.upsert({
        where: { email: "admin_staff@rentpe.in" },
        update: {},
        create: {
            email: "admin_staff@rentpe.in",
            passwordHash: adminStaffPassword,
            role: "ADMIN",
            roles: ["ADMIN"],
            isAdmin: true,
            adminRole: null,
            name: "Admin Staff",
            phone: "9000000002",
            status: "ACTIVE",
            emailVerified: true,
            adminProfile: {
                create: {
                    displayId: "ADM-EMP-0002",
                    name: "Admin Staff",
                    email: "admin_staff@rentpe.in",
                    phone: "9000000002",
                    department: "Operations",
                    role: "Platform Moderator",
                    permissions: JSON.stringify(["users", "properties", "bookings", "operations", "tickets"]),
                    status: "ACTIVE"
                }
            }
        }
    });
    console.log("✅ Admin Staff (upserted):", adminStaff.email);

    const owner = await prisma.user.upsert({
        where: { email: "owner@rentpe.in" },
        update: { emailVerified: true },
        create: {
            displayId: `RP-U-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
            email: "owner@rentpe.in",
            passwordHash: ownerPassword,
            role: "OWNER",
            name: "Amit Kumar",
            phone: "9123456789",
            status: "VERIFIED",
            emailVerified: true
        }
    });
    console.log("✅ Owner (upserted):", owner.email);

    const studentEmails = ["rahul@example.com", "priya@example.com", "sneha@example.com"];
    for (const email of studentEmails) {
        const name = email.split('@')[0];
        await prisma.user.upsert({
            where: { email },
            update: { emailVerified: true },
            create: {
                displayId: `RP-U-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
                email,
                passwordHash: studentPassword,
                role: "USER",
                name: name.charAt(0).toUpperCase() + name.slice(1),
                phone: "9" + Math.floor(Math.random() * 900000000 + 100000000).toString(),
                status: "ACTIVE",
                emailVerified: true
            }
        });
    }
    const student1 = await prisma.user.findUnique({ where: { email: "rahul@example.com" } }) as any;
    const student2 = await prisma.user.findUnique({ where: { email: "priya@example.com" } }) as any;
    const student3 = await prisma.user.findUnique({ where: { email: "sneha@example.com" } }) as any;
    console.log("✅ Students (upserted)");


    // ─── Create Property ─────────────────────────────
    let property = await prisma.property.findFirst({
        where: { name: "Stanza Living Delhi - North Campus" }
    });
    
    if (!property) {
        property = await prisma.property.create({
            data: {
                ownerId: owner.id,
                name: "Stanza Living Delhi - North Campus",
                address: "Near Delhi University, North Campus, Kamla Nagar",
                city: "Delhi",
                description: "Premium co-living PG with modern amenities near DU North Campus. WiFi, meals, laundry, and 24/7 security included.",
                amenities: JSON.stringify(["WiFi", "Meals", "Laundry", "AC", "Power Backup", "Security", "Parking", "CCTV", "Housekeeping"]),
                images: JSON.stringify(["/images/pg1.jpg", "/images/pg2.jpg"]),
                status: "LIVE"
            }
        });
        console.log("✅ Property created:", property.name);
    } else {
        console.log("ℹ️ Property already exists:", property.name);
    }

    // ─── Create Rooms ────────────────────────────────
    const existingRooms = await prisma.room.findFirst({ where: { propertyId: property.id } });
    if (!existingRooms) {
        await prisma.room.create({ data: { propertyId: property.id, roomNumber: "101", type: "Single", price: 18000, availability: 1, displayId: "RP-R-10000001" } });
        await prisma.room.create({ data: { propertyId: property.id, roomNumber: "204", type: "Double", price: 15000, availability: 2, displayId: "RP-R-10000002" } });
        await prisma.room.create({ data: { propertyId: property.id, roomNumber: "305", type: "Triple", price: 12000, availability: 3, displayId: "RP-R-10000003" } });
        await prisma.room.create({ data: { propertyId: property.id, roomNumber: "102", type: "Single", price: 18000, availability: 1, displayId: "RP-R-10000004" } });
        await prisma.room.create({ data: { propertyId: property.id, roomNumber: "206", type: "Double", price: 15000, availability: 0, displayId: "RP-R-10000005" } });
        console.log("✅ 5 Rooms created");
    } else {
        console.log("ℹ️ Rooms already exist");
    }
    
    // Refresh room IDs for tenants
    const room1 = await prisma.room.findFirst({ where: { propertyId: property.id, roomNumber: "101" } }) as any;
    const room2 = await prisma.room.findFirst({ where: { propertyId: property.id, roomNumber: "204" } }) as any;
    const room3 = await prisma.room.findFirst({ where: { propertyId: property.id, roomNumber: "305" } }) as any;

    const existingBookings = await prisma.booking.findFirst({ where: { propertyName: property.name } });
    if (!existingBookings) {
        // ─── Create Tenants ──────────────────────────────
        const tenant1 = await prisma.tenant.create({
            data: {
                displayId: "RP-TN-000001", name: "Priya Verma", phone: "9876543210", email: "priya@example.com",
                propertyId: property.id, roomId: room2.id, roomNumber: "204", roomType: "Double",
                rent: 15000, startDate: "01 Jan 2024", status: "ACTIVE", studentId: student2.id
            }
        });
        const tenant2 = await prisma.tenant.create({
            data: {
                displayId: "RP-TN-000002", name: "Amit Rathore", phone: "9123456789", email: "amit.r@example.com",
                propertyId: property.id, roomId: room3.id, roomNumber: "305", roomType: "Triple",
                rent: 12000, startDate: "15 Jan 2024", status: "ACTIVE", studentId: student1.id
            }
        });
        const tenant3 = await prisma.tenant.create({
            data: {
                displayId: "RP-TN-000003", name: "Sneha Gupta", phone: "9988776655", email: "sneha@example.com",
                propertyId: property.id, roomId: room1.id, roomNumber: "101", roomType: "Single",
                rent: 18000, startDate: "01 Feb 2024", status: "ACTIVE", studentId: student3.id
            }
        });
        console.log("✅ 3 Tenants created");

        // ─── Create Rent Records ─────────────────────────
        await prisma.rentRecord.createMany({
            data: [
                { tenantId: tenant1.id, month: "Jan 2024", amount: 15000, paid: true, paidOn: "02 Jan 2024" },
                { tenantId: tenant1.id, month: "Feb 2024", amount: 15000, paid: true, paidOn: "01 Feb 2024" },
                { tenantId: tenant2.id, month: "Jan 2024", amount: 12000, paid: true, paidOn: "16 Jan 2024" },
                { tenantId: tenant2.id, month: "Feb 2024", amount: 12000, paid: false },
                { tenantId: tenant3.id, month: "Feb 2024", amount: 18000, paid: false },
            ]
        });
        console.log("✅ Rent records created");

        // ─── Create Bookings ─────────────────────────────
        await prisma.booking.create({
            data: {
                displayId: "RP-B-000001", userId: student1.id, propertyName: property.name,
                occupancy: "Double Occupancy (₹15,000/month)", guestName: "Rahul Sharma",
                moveInDate: "2024-03-01", status: "PENDING_APPROVAL", paymentStatus: "UNPAID", amount: 15000
            }
        });
        await prisma.booking.create({
            data: {
                displayId: "RP-B-000002", userId: student2.id, roomId: room2.id,
                propertyName: property.name, occupancy: "Double Occupancy (₹15,000/month)",
                guestName: "Priya Verma", moveInDate: "2024-01-01",
                status: "PAID", paymentStatus: "PAID", amount: 15000, roomAssigned: "204 (Double)"
            }
        });
        console.log("✅ Bookings created");
    } else {
        console.log("ℹ️ Tenants and Bookings already exist");
    }

    // ─── Food Menu ───────────────────────────────────
    const meals = [
        { day: "Monday", breakfast: "Aloo Paratha, Curd, Chai", lunch: "Dal, Rice, Roti, Sabzi", dinner: "Paneer Butter Masala, Roti, Rice" },
        { day: "Tuesday", breakfast: "Poha, Chai", lunch: "Rajma, Rice, Roti", dinner: "Chole, Rice, Roti" },
        { day: "Wednesday", breakfast: "Idli Sambhar, Chai", lunch: "Dal Fry, Rice, Roti, Salad", dinner: "Mix Veg, Roti, Rice, Raita" },
        { day: "Thursday", breakfast: "Bread Omelette, Chai", lunch: "Kadhi Chawal, Roti", dinner: "Malai Kofta, Rice, Roti" },
        { day: "Friday", breakfast: "Upma, Chai", lunch: "Aloo Gobi, Dal, Rice, Roti", dinner: "Dal Makhani, Jeera Rice, Roti" },
        { day: "Saturday", breakfast: "Chole Bhature, Lassi", lunch: "Biryani, Raita, Salad", dinner: "Palak Paneer, Rice, Roti" },
        { day: "Sunday", breakfast: "Puri Sabzi, Chai", lunch: "Special Thali", dinner: "Butter Chicken/Paneer, Naan, Rice" },
    ];
    const existingFood = await prisma.foodMenu.findFirst({ where: { propertyId: property.id } });
    if (!existingFood) {
        for (const m of meals) {
            await prisma.foodMenu.create({ data: { propertyId: property.id, dayOfWeek: m.day, mealType: "Breakfast", items: m.breakfast } });
            await prisma.foodMenu.create({ data: { propertyId: property.id, dayOfWeek: m.day, mealType: "Lunch", items: m.lunch } });
            await prisma.foodMenu.create({ data: { propertyId: property.id, dayOfWeek: m.day, mealType: "Dinner", items: m.dinner } });
        }
        console.log("✅ Weekly food menu created");
    } else {
        console.log("ℹ️ Food menu already exists");
    }

    // ─── Team Members (now using Employee model — TeamMember was dropped July 2026) ──
    const existingTeam = await prisma.employee.findFirst({ where: { email: "neha@rentpe.in" } });
    if (!existingTeam) {
        await prisma.employee.create({
            data: {
                displayId: "RP-E-10000001", name: "Neha Kapoor", email: "neha@rentpe.in", phone: "9001020304",
                designation: "Support Lead",      // Employee uses designation (not role)
                department: "Customer Support",    // required field
                permissions: JSON.stringify(["login_issues", "payment_failed", "support_tickets", "booking_disputes"]),
                status: "ACTIVE"
            }
        });
        await prisma.employee.create({
            data: {
                displayId: "RP-E-10000002", name: "Rajesh Pandey", email: "rajesh@rentpe.in", phone: "9405060708",
                designation: "Finance Ops",
                department: "Finance",
                permissions: JSON.stringify(["payment_failed", "transaction_view", "reports"]),
                status: "ACTIVE"
            }
        });
        console.log("✅ Admin team members created (Employee model)");
    } else {
        console.log("ℹ️ Admin team members already exist");
    }

    // ─── Owner Staff ─────────────────────────────────
    const existingStaff = await prisma.ownerStaff.findFirst({ where: { email: "ravi@pg.com" } });
    if (!existingStaff) {
        await prisma.ownerStaff.create({
            data: {
                displayId: "RP-S-10000001", ownerId: owner.id, name: "Ravi Kumar",
                email: "ravi@pg.com", phone: "9112131415", designation: "Property Manager",
                permissions: JSON.stringify(["view_bookings", "approve_bookings", "manage_tenants", "mark_rent", "vacate_tenant", "edit_rooms"]),
                status: "ACTIVE"
            }
        });
        await prisma.ownerStaff.create({
            data: {
                displayId: "RP-S-10000002", ownerId: owner.id, name: "Anita Devi",
                email: "anita@pg.com", phone: "9223344556", designation: "Accountant",
                permissions: JSON.stringify(["view_payments", "mark_rent", "view_bookings"]),
                status: "ACTIVE"
            }
        });
        console.log("✅ Owner staff members created");
    } else {
        console.log("ℹ️ Owner staff members already exist");
    }

    console.log("\n🎉 Seeding complete! Demo accounts:");
    console.log("   Admin:   admin@rentpe.in        / RentPeAdmin@2026");
    console.log("   Staff:   admin_staff@rentpe.in  / RentPeStaff@2026");
    console.log("   Owner:   owner@rentpe.in        / owner123");
    console.log("   Student: rahul@example.com      / student123");
    console.log("\n📋 New ID Format:");
    console.log("   Bookings : RP-B-000001");
    console.log("   Tenants  : RP-TN-000001");
    console.log("   Invoices : RP-INV-26-27-000001");
    console.log("   Payments : RP-PAY-26-27-000001");
}

main()
    .catch(e => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
