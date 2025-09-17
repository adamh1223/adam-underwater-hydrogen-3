import ContactForm from '~/components/form/Contact';
import NavExample from '~/components/navbar/NavExample';

function ContactPage() {
  return (
    <div className="flex flex-col items-center pt-4">
      <img
        src="/contact2.png"
        alt="Contact Banner"
        className="mb-5"
        style={{height: '100px'}}
      />
      <ContactForm />
    </div>
  );
}

export default ContactPage;
