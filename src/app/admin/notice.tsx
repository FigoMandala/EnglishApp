/** Pesan hasil aksi admin dari query string (?pesan= / ?galat=). */
export function Notice({ pesan, galat }: { pesan?: string; galat?: string }) {
  if (galat) {
    return (
      <p role="alert" className="rounded-control border-2 border-brick/30 bg-brick-soft px-4 py-3 font-bold text-brick-deep">
        {galat}
      </p>
    );
  }
  if (pesan) {
    return (
      <p role="status" className="rounded-control border-2 border-primary/25 bg-primary-soft px-4 py-3 font-bold text-primary-deep">
        {pesan}
      </p>
    );
  }
  return null;
}

export type AdminSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}
