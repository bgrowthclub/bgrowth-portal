export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-400/10 dark:text-red-300">
      {message}
    </p>
  );
}
