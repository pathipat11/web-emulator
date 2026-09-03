import PhoneControllerClient from "@/components/phone-controller/PhoneControllerClient";

export default async function ControllerPage({
    searchParams,
}: {
    searchParams: Promise<{ code?: string | string[] }>;
}) {
    const params = await searchParams;
    const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
    const initialCode = /^\d{6}$/.test(rawCode ?? "") ? rawCode ?? "" : "";

    return <PhoneControllerClient initialCode={initialCode} />;
}
