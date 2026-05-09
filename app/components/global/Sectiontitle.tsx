import {Separator} from '~/components/ui/separator';

function Sectiontitle({text}: {text: string}) {
  return (
    <div>
      <h2 className="text-2xl tracking-wider capitalize px-3 pb-2 flex justify-center">
        {text}
      </h2>
      <Separator />
    </div>
  );
}

export default Sectiontitle;
