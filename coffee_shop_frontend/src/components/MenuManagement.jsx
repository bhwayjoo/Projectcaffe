import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Switch } from "../components/ui/switch";
import { Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import {
  getMenuItems,
  getCategories,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../api/customAcios";
import { toast } from "../components/ui/use-toast";

const MenuManagement = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    is_available: true,
    image: null,
  });

  const {
    data: menuItems,
    isLoading: itemsLoading,
    error: itemsError,
  } = useQuery("menuItems", getMenuItems, {
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load menu items",
        variant: "destructive",
      });
    },
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery(
    "categories",
    getCategories,
    {
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to load categories",
          variant: "destructive",
        });
      },
    }
  );

  const createMenuItemMutation = useMutation(createMenuItem, {
    onSuccess: () => {
      queryClient.invalidateQueries("menuItems");
      resetForm();
      toast({
        title: "Success",
        description: "Item created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  const updateMenuItemMutation = useMutation(
    (data) => updateMenuItem(selectedItem.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries("menuItems");
        resetForm();
        toast({
          title: "Success",
          description: "Item updated successfully",
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to update item",
          variant: "destructive",
        });
      },
    }
  );

  const deleteMenuItemMutation = useMutation(deleteMenuItem, {
    onSuccess: () => {
      queryClient.invalidateQueries("menuItems");
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setFormData({ ...formData, image: file });
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Form validation
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: "Error",
        description: "Please select a category",
        variant: "destructive",
      });
      return;
    }

    if (selectedItem) {
      updateMenuItemMutation.mutate(formData);
    } else {
      createMenuItemMutation.mutate(formData);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setImagePreview(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "",
      is_available: true,
      image: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = (itemId) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      deleteMenuItemMutation.mutate(itemId);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Menu Management</CardTitle>
          <CardDescription>
            Add, edit, or remove items from your menu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Item Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <Textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Price"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
              }
            />
            {!categoriesLoading && (
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_available}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_available: checked })
                }
              />
              <span>Available</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Upload Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-xs h-32 object-cover rounded"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  createMenuItemMutation.isLoading ||
                  updateMenuItemMutation.isLoading
                }
              >
                {(createMenuItemMutation.isLoading ||
                  updateMenuItemMutation.isLoading) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedItem ? "Update Item" : "Add Item"}
              </Button>
              {selectedItem && (
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>

          <div className="mt-8">
            {itemsLoading ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : itemsError ? (
              <Alert variant="destructive">
                <AlertDescription>Failed to load menu items.</AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-4">
                {menuItems?.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-4">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-24 h-24 object-cover rounded"
                          />
                        )}
                        <div>
                          <h3 className="font-bold">{item.name}</h3>
                          <p className="text-sm text-gray-600">
                            {item.description}
                          </p>
                          <p className="text-sm">${item.price}</p>
                          <p className="text-sm text-gray-500">
                            Category: {item.category_name}
                          </p>
                          <p
                            className={`text-sm ${
                              item.is_available
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {item.is_available ? "Available" : "Not Available"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedItem(item);
                            setFormData({
                              name: item.name,
                              description: item.description,
                              price: item.price,
                              category: item.category,
                              is_available: item.is_available,
                              image: null,
                            });
                            setImagePreview(item.image);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MenuManagement;
