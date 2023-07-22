import { GenericErrorPage } from "@/features/ui/genericErrorPage";

export default function Custom404() {
  return (
    <GenericErrorPage
      title="Page Not Found"
      text={["You took a bad turn! Sorry about that."]}
    />
  );
}
