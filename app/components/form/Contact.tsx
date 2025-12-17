import {useRef, useState} from 'react';
import {Label} from '~/components/ui/label';
import {Input} from '~/components/ui/input';
import {Button} from '~/components/ui/button';
import './styles/Contact.css';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const {name, value} = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setImageError('');

    if (files.length > 3) {
      setImageError('You can upload up to 3 images.');
      e.target.value = '';
      return;
    }

    setSelectedImages(files);
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageError) {
      setStatus(imageError);
      return;
    }
    setStatus('Sending...');

    try {
      const formPayload = new FormData();
      formPayload.append('name', formData.name);
      formPayload.append('email', formData.email);
      formPayload.append('message', formData.message);

      selectedImages.forEach((image) => {
        formPayload.append('contactImages', image);
      });

      const response = await fetch('/api/contact', {
        method: 'POST',
        body: formPayload,
      });

      const result = await response.json();

      if (response.ok) {
        setStatus('Message sent successfully!');
        setFormData({
          name: '',
          email: '',
          message: '',
        });
        setSelectedImages([]);
        setImageError('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setStatus(result?.error || 'Failed to submit form. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      setStatus('An error occurred. Please try again later.');
    }
  };

  return (
    <div className="container px-7">
      <form
        onSubmit={handleSubmit}
        className="border-2 border-gray-600 dark:border-gray-700 p-8 rounded-md shadow-md space-y-8"
      >
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Contact Me</h2>
          <p>
            Please fill the form below and I will get back to you as soon as
            possible.
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="required" htmlFor="name">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="required" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="required" htmlFor="message">
              Message
            </Label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Type your message"
              rows={4}
              className="w-full message bg-background border border-input border-gray-300 dark:border-gray-700 rounded-sm p-2"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactImages">(optional) Upload Images </Label>
            <input
              id="contactImages"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={triggerFileSelect}
                className="cursor-pointer"
              >
                Upload Images
              </Button>
              {selectedImages.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Selected ({selectedImages.length}/3):{' '}
                  {selectedImages.map((file) => file.name).join(', ')}
                </div>
              )}
            </div>
            {imageError && (
              <p className="text-sm text-red-500 font-medium">{imageError}</p>
            )}
          </div>
          <div className="submit ">
            <Button type="submit" className="w-50 bg-primary">
              Submit
            </Button>
          </div>
        </div>
        {status && <p className="text-center text-gray-600">{status}</p>}
      </form>
    </div>
  );
}
