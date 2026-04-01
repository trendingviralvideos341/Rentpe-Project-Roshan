import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding RentPe database...\n");

    // ─── Clear existing data ─────────────────────────
    await prisma.actionNote.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.rentRecord.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.foodMenu.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.ownerStaff.deleteMany();
    await prisma.room.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();

    // ─── Create Users ────────────────────────────────
    const adminPassword = await hash("RentPeAdmin@2026", 10);
    const ownerPassword = await hash("owner123", 10);
    const studentPassword = await hash("student123", 10);

    const admin = await prisma.user.create({
        data: {
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
    console.log("✅ Admin created:", admin.email);

    const adminStaffPassword = await hash("RentPeStaff@2026", 10);
    const adminStaff = await prisma.user.create({
        data: {
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
    console.log("✅ Admin Staff created:", adminStaff.email);

    const owner = await prisma.user.create({
        data: {
            email: "owner@rentpe.in",
            passwordHash: ownerPassword,
            role: "OWNER",
            name: "Amit Kumar",
            phone: "9123456789",
            status: "VERIFIED"
        }
    });
    console.log("✅ Owner created:", owner.email);

    const student1 = await prisma.user.create({
        data: {
            email: "rahul@example.com",
            passwordHash: studentPassword,
            role: "USER",
            name: "Rahul Sharma",
            phone: "9876543210",
            status: "ACTIVE"
        }
    });

    const student2 = await prisma.user.create({
        data: {
            email: "priya@example.com",
            passwordHash: studentPassword,
            role: "USER",
            name: "Priya Verma",
            phone: "9988776655",
            status: "ACTIVE"
        }
    });

    const student3 = await prisma.user.create({
        data: {
            email: "sneha@example.com",
            passwordHash: studentPassword,
            role: "USER",
            name: "Sneha Gupta",
            phone: "9112233445",
            status: "ACTIVE"
        }
    });
    console.log("✅ 3 Students created");

    // ─── Create Property ─────────────────────────────
    const property = await prisma.property.create({
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

    // ─── Create Rooms ────────────────────────────────
    const room1 = await prisma.room.create({ data: { propertyId: property.id, roomNumber: "101", type: "Single", price: 18000, availability: 1 } });
    const room2 = await prisma.room.create({ data: { propertyId: property.id, roomNumber: "204", type: "Double", price: 15000, availability: 2 } });
    const room3 = await prisma.room.create({ data: { propertyId: property.id, roomNumber: "305", type: "Triple", price: 12000, availability: 3 } });
    const room4 = await prisma.room.create({ data: { propertyId: property.id, roomNumber: "102", type: "Single", price: 18000, availability: 1 } });
    const room5 = await prisma.room.create({ data: { propertyId: property.id, roomNumber: "206", type: "Double", price: 15000, availability: 0 } });
    console.log("✅ 5 Rooms created");

    // ─── Create Tenants ──────────────────────────────
    const tenant1 = await prisma.tenant.create({
        data: {
            displayId: "TNT-001", name: "Priya Verma", phone: "9876543210", email: "priya@example.com",
            propertyId: property.id, roomId: room2.id, roomNumber: "204", roomType: "Double",
            rent: 15000, startDate: "01 Jan 2024", status: "ACTIVE", studentId: student2.id
        }
    });
    const tenant2 = await prisma.tenant.create({
        data: {
            displayId: "TNT-002", name: "Amit Rathore", phone: "9123456789", email: "amit.r@example.com",
            propertyId: property.id, roomId: room3.id, roomNumber: "305", roomType: "Triple",
            rent: 12000, startDate: "15 Jan 2024", status: "ACTIVE", studentId: student1.id // Reusing student1 for demo
        }
    });
    const tenant3 = await prisma.tenant.create({
        data: {
            displayId: "TNT-003", name: "Sneha Gupta", phone: "9988776655", email: "sneha@example.com",
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
            displayId: "REQ-10001001", userId: student1.id, propertyName: property.name,
            occupancy: "Double Occupancy (₹15,000/month)", guestName: "Rahul Sharma",
            moveInDate: "2024-03-01", status: "PENDING_APPROVAL", paymentStatus: "UNPAID", amount: 15000
        }
    });
    await prisma.booking.create({
        data: {
            displayId: "REQ-10001002", userId: student2.id, roomId: room2.id,
            propertyName: property.name, occupancy: "Double Occupancy (₹15,000/month)",
            guestName: "Priya Verma", moveInDate: "2024-01-01",
            status: "PAID", paymentStatus: "PAID", amount: 15000, roomAssigned: "204 (Double)"
        }
    });
    console.log("✅ Bookings created");

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
    for (const m of meals) {
        await prisma.foodMenu.create({ data: { propertyId: property.id, dayOfWeek: m.day, mealType: "Breakfast", items: m.breakfast } });
        await prisma.foodMenu.create({ data: { propertyId: property.id, dayOfWeek: m.day, mealType: "Lunch", items: m.lunch } });
        await prisma.foodMenu.create({ data: { propertyId: property.id, dayOfWeek: m.day, mealType: "Dinner", items: m.dinner } });
    }
    console.log("✅ Weekly food menu created");

    // ─── Team Members ────────────────────────────────
    await prisma.teamMember.create({
        data: {
            displayId: "ADM-T001", name: "Neha Kapoor", email: "neha@rentpe.in", phone: "9001020304",
            role: "Support Lead", permissions: JSON.stringify(["login_issues", "payment_failed", "support_tickets", "booking_disputes"]),
            status: "ACTIVE"
        }
    });
    await prisma.teamMember.create({
        data: {
            displayId: "ADM-T002", name: "Rajesh Pandey", email: "rajesh@rentpe.in", phone: "9405060708",
            role: "Finance Ops", permissions: JSON.stringify(["payment_failed", "transaction_view", "reports"]),
            status: "ACTIVE"
        }
    });
    console.log("✅ Admin team members created");

    // ─── Owner Staff ─────────────────────────────────
    await prisma.ownerStaff.create({
        data: {
            displayId: "STF-001", ownerId: owner.id, name: "Ravi Kumar",
            email: "ravi@pg.com", phone: "9112131415", designation: "Property Manager",
            permissions: JSON.stringify(["view_bookings", "approve_bookings", "manage_tenants", "mark_rent", "vacate_tenant", "edit_rooms"]),
            status: "ACTIVE"
        }
    });
    await prisma.ownerStaff.create({
        data: {
            displayId: "STF-002", ownerId: owner.id, name: "Anita Devi",
            email: "anita@pg.com", phone: "9223344556", designation: "Accountant",
            permissions: JSON.stringify(["view_payments", "mark_rent", "view_bookings"]),
            status: "ACTIVE"
        }
    });
    console.log("✅ Owner staff members created");

    console.log("\n🎉 Seeding complete! Demo accounts:");
    console.log("   Admin:   admin@rentpe.in   / admin123");
    console.log("   Owner:   owner@rentpe.in   / owner123");
    console.log("   Student: rahul@example.com / student123");
}

main()
    .catch(e => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
