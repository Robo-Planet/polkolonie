import { prisma } from "@/lib/db";
import { OrganizerForm } from "@/components/OrganizerForm";

export const dynamic = "force-dynamic";

export default async function OrganizatorPage() {
  const o = await prisma.organizer.findUnique({ where: { id: 1 } });
  return (
    <>
      <h1>Dane organizatora</h1>
      <p>Te dane trafiają do umowy i karty kwalifikacyjnej.</p>
      <OrganizerForm
        defaults={
          o
            ? { name: o.name, nip: o.nip, street: o.street, postalCode: o.postalCode, city: o.city, bankName: o.bankName, bankAccount: o.bankAccount }
            : { name: "ROBOPLANET EVENTS S.C.", nip: "957-113-76-36", bankName: "Erste" }
        }
      />
    </>
  );
}
