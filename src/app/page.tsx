import { AuroraText } from "@/components/magicui/aurora-text";
import ResendEmailForm from "@/components/resend/form";

export default function Home() {
  return (
    <div className="flex flex-col gap-4 items-center min-h-screen p-4">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold">
          Welcome to{" "}
          <AuroraText colors={["#6600ff", "#69e300", "#80ffce"]}>
            CustomHack
          </AuroraText>
          !
        </h1>
        <ResendEmailForm />
      </main>
    </div>
  );
}
