import { useState } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import "./styles/Contact.css";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [status, setStatus] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Sending...");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus("Message sent successfully!");
        setFormData({
          name: "",
          email: "",
          message: "",
        });
      } else {
        setStatus("Failed to send message. Please try again.");
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus("An error occurred. Please try again later.");
    }
  };

  return (
    <div className="container">
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
