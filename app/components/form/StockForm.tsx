import {useEffect, useState} from 'react';
import {Checkbox} from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {Button} from '../ui/button';
import {Label} from '../ui/label';
import {Input} from '../ui/input';
import './styles/StockForm.css';
import {CourierClient} from '@trycourier/courier';
import {ClipboardSignature} from 'lucide-react';

const courier = new CourierClient({
  authorizationToken: 'dk_prod_YD7MPFEFARMTTYM3ASDX55T6ZD08',
});
function StockForm({
  updateCheck,
  clipNames,
}: {
  updateCheck: React.Dispatch<React.SetStateAction<boolean>>;
  clipNames: string[];
}) {
  const [formData, setFormData] = useState({
    clips: clipNames.join(', '),
    name: '',
    email: '',
    youtube: '',
    vimeo: '',
    instagram: '',
    tiktok: '',
    facebook: '',
    website: '',
    independent: '',
    advertisement: '',
    other: '',
  });

  const [status, setStatus] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePlatforms, setAgreePlatforms] = useState(false);
  const [error, setError] = useState('');
  const [checkedBox, setCheckedBox] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const {name, value} = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreeTerms || !agreePlatforms) {
      setError('Please agree to the terms and conditions before submitting.');
      return;
    }

    setError('');
    setStatus('Sending...');

    try {
      const response = await fetch('/api/courier', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(formData),
      });
      console.log(response, '353535');

      if (true) {
        setStatus('Form submitted successfully!');
        setFormData({
          clips: '',
          name: '',
          email: '',
          youtube: '',
          vimeo: '',
          instagram: '',
          tiktok: '',
          facebook: '',
          website: '',
          independent: '',
          advertisement: '',
          other: '',
        });
        setCheckedBox(true);
        updateCheck(true);
        setAgreeTerms(false);
        setAgreePlatforms(false);
      } else {
        setStatus('Failed to submit form. Please try again later.');
      }
    } catch (error) {
      console.error('Error:', error);
      setStatus('An error occurred. Please try again later.');
    }
  };
  console.log(checkedBox);

  return (
    <>
      <Checkbox checked={checkedBox}></Checkbox>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Stock Footage Licensing Form</Button>
        </DialogTrigger>
        <DialogContent className="modal">
          <DialogHeader>
            <DialogTitle>
              Please list all channels where purchased stock footage will
              appear.
            </DialogTitle>
            <DialogDescription className="py-3">
              By purchasing stock footage from Adam Underwater, you must list
              the channels and/or films in which the stock footage will appear.
              These channels are given access to the footage for use publicly.{' '}
              <div className="flex justify-start one-entry">
                Only one entry per platform is allowed.{' '}
              </div>
              Channels not listed are not given access to post this stock
              footage publicly, and are subject to a copyright infringement
              violation where stock footage from Adam Underwater appears.
              Unauthorized platforms using stock footage may result in content
              being taken down.{' '}
              <div className="flex justify-start one-entry">
                Second-hand sale of purchased clips is not permitted.
              </div>{' '}
              <div className="flex justify-start one-entry">
                All stock footage videos are final sale.
              </div>{' '}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center">
            <Label className="w-30 text-right">Clips</Label>
            {/* TODO: filter or map through each clip and list it at the top of the form. Should not be editable */}
            <div>{formData.clips}</div>
          </div>
          <div className="grid gap-4 py-4 modal-content">
            {/* Left Column */}
            <div className="flex flex-col gap-4">
              {[
                {id: 'name', label: 'Name', placeholder: 'Your name'},
                {
                  id: 'email',
                  label: 'Email',
                  placeholder: 'example@example.com',
                },
                {
                  id: 'youtube',
                  label: 'Youtube',
                  placeholder: 'Youtube channel URL',
                },
                {id: 'vimeo', label: 'Vimeo', placeholder: 'Vimeo channel URL'},
                {
                  id: 'instagram',
                  label: 'Instagram',
                  placeholder: 'Instagram handle',
                },
                {id: 'tiktok', label: 'Tiktok', placeholder: 'Tiktok handle'},
              ].map(({id, label, placeholder}) => (
                <div key={id} className="flex items-center gap-4">
                  <Label htmlFor={id} className="w-32 text-right">
                    {label}
                  </Label>
                  <Input
                    id={id}
                    name={id}
                    placeholder={placeholder}
                    className="flex-grow"
                    onChange={handleChange}
                    value={formData[id as keyof typeof formData]}
                  />
                </div>
              ))}
            </div>
            {/* Right Column */}
            <div className="flex flex-col gap-4">
              {[
                {
                  id: 'facebook',
                  label: 'Facebook',
                  placeholder: 'Facebook profile URL',
                },
                {id: 'website', label: 'Website', placeholder: 'Website URL'},
                {
                  id: 'independent',
                  label: 'Film',
                  placeholder: 'Name of Film',
                },
                {
                  id: 'advertisement',
                  label: 'Advertisement',
                  placeholder: 'Company & Product',
                },
                {id: 'other', label: 'Other', placeholder: 'Channel URL'},
              ].map(({id, label, placeholder}) => (
                <div key={id} className="flex items-center gap-4">
                  <Label htmlFor={id} className="w-32 text-right">
                    {label}
                  </Label>
                  <Input
                    id={id}
                    name={id}
                    placeholder={placeholder}
                    className="flex-grow"
                    onChange={handleChange}
                    value={formData[id as keyof typeof formData]}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex flex-col items-center gap-4 py-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="licensingForm"
                  checked={agreeTerms}
                  onCheckedChange={(checked) => setAgreeTerms(checked === true)}
                />
                <Label htmlFor="licensingForm">
                  I agree to these terms and conditions
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="platform-terms"
                  checked={agreePlatforms}
                  onCheckedChange={(checked) =>
                    setAgreePlatforms(checked === true)
                  }
                />
                <Label htmlFor="platform-terms">
                  I have listed all platforms where this stock footage will be
                  shown
                </Label>
              </div>
            </div>
            <Button type="submit" className="self-end" onClick={handleSubmit}>
              Submit
            </Button>
          </DialogFooter>
          <div className="flex justify-center pb-5">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {status && <p className="text-md">{status}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default StockForm;
