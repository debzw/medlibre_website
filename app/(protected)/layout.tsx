'use client';



export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main className="flex-1">{children}</main>
    );
}
