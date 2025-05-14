import { Separator } from "~/components/ui/separator";

function Sectiontitle({ text }: { text: string }) {
  return (
    <div>
      <h2 className="text-3xl font-medium tracking-wider capitalize p-3 flex justify-center">
        {text}
      </h2>
      <Separator />
    </div>
  );
}

export default Sectiontitle;
