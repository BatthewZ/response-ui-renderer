import { default as analyticsDashboard } from './analytics-dashboard.viewspec.json';
import { default as contactForm } from './contact-form.viewspec.json';
import { default as pricingTable } from './pricing-table.viewspec.json';
import { default as productLanding } from './product-landing.viewspec.json';
import { default as teamDirectory } from './team-directory.viewspec.json';
/**
 * Documents produced by a real generator, kept verbatim.
 *
 * They are the package's regression corpus: between them they exercise `$each`,
 * `$cond`, `$ref`, `$field`, forms with validation, compound components and
 * static data bindings. Synthetic fixtures drift towards what the renderer
 * already handles; these do not.
 */
export declare const exampleSpecs: {
    readonly analyticsDashboard: {
        version: number;
        title: string;
        description: string;
        data: {
            metrics: {
                type: string;
                value: {
                    label: string;
                    value: string;
                    trend: number;
                    direction: string;
                }[];
            };
            projects: {
                type: string;
                value: {
                    name: string;
                    progress: number;
                }[];
            };
            activities: {
                type: string;
                value: {
                    title: string;
                    date: string;
                    status: string;
                }[];
            };
            showWelcome: {
                type: string;
                value: boolean;
            };
        };
        root: {
            component: string;
            children: {
                component: string;
                props: {
                    gap: string;
                };
                children: ({
                    component: string;
                    props: {
                        variant: string;
                        gap?: undefined;
                        wrap?: undefined;
                        defaultValue?: undefined;
                    };
                    children: string[];
                    $cond?: undefined;
                    then?: undefined;
                } | {
                    $cond: string;
                    then: {
                        component: string;
                        props: {
                            variant: string;
                        };
                        children: string[];
                    };
                    component?: undefined;
                    props?: undefined;
                    children?: undefined;
                } | {
                    component: string;
                    props: {
                        gap: string;
                        wrap: boolean;
                        variant?: undefined;
                        defaultValue?: undefined;
                    };
                    children: {
                        $each: string;
                        as: string;
                        node: {
                            component: string;
                            children: ({
                                component: string;
                                props: {
                                    children: {
                                        $ref: string;
                                    };
                                    value?: undefined;
                                    direction?: undefined;
                                };
                            } | {
                                component: string;
                                props: {
                                    value: {
                                        $ref: string;
                                    };
                                    direction: {
                                        $ref: string;
                                    };
                                    children?: undefined;
                                };
                            })[];
                        };
                    }[];
                    $cond?: undefined;
                    then?: undefined;
                } | {
                    component: string;
                    props: {
                        defaultValue: string;
                        variant: string;
                        gap?: undefined;
                        wrap?: undefined;
                    };
                    children: ({
                        component: string;
                        children: {
                            component: string;
                            props: {
                                value: string;
                            };
                            children: string[];
                        }[];
                        props?: undefined;
                    } | {
                        component: string;
                        props: {
                            value: string;
                        };
                        children: {
                            component: string;
                            props: {
                                gap: string;
                            };
                            children: {
                                $each: string;
                                as: string;
                                node: {
                                    component: string;
                                    props: {
                                        padding: string;
                                    };
                                    children: {
                                        component: string;
                                        props: {
                                            gap: string;
                                        };
                                        children: ({
                                            component: string;
                                            props: {
                                                variant: string;
                                                weight: string;
                                                value?: undefined;
                                                max?: undefined;
                                                animate?: undefined;
                                            };
                                            children: {
                                                $ref: string;
                                            }[];
                                        } | {
                                            component: string;
                                            props: {
                                                value: {
                                                    $ref: string;
                                                };
                                                max: number;
                                                animate: boolean;
                                                variant?: undefined;
                                                weight?: undefined;
                                            };
                                            children?: undefined;
                                        })[];
                                    }[];
                                };
                            }[];
                        }[];
                    } | {
                        component: string;
                        props: {
                            value: string;
                        };
                        children: {
                            component: string;
                            props: {
                                animate: boolean;
                            };
                            children: {
                                $each: string;
                                as: string;
                                node: {
                                    component: string;
                                    props: {
                                        title: {
                                            $ref: string;
                                        };
                                        date: {
                                            $ref: string;
                                        };
                                    };
                                    children: {
                                        component: string;
                                        props: {
                                            children: {
                                                $ref: string;
                                            };
                                        };
                                    }[];
                                };
                            }[];
                        }[];
                    })[];
                    $cond?: undefined;
                    then?: undefined;
                })[];
            }[];
        };
    };
    readonly contactForm: {
        version: number;
        title: string;
        description: string;
        forms: {
            contact: {
                fields: {
                    name: {
                        initialValue: string;
                    };
                    email: {
                        initialValue: string;
                    };
                    subject: {
                        initialValue: string;
                    };
                    message: {
                        initialValue: string;
                    };
                };
                onSubmit: {
                    action: string;
                    payload: {
                        message: string;
                        variant: string;
                        title: string;
                    };
                };
            };
        };
        root: {
            component: string;
            children: {
                component: string;
                props: {
                    gap: string;
                };
                children: ({
                    component: string;
                    props: {
                        variant: string;
                        color?: undefined;
                        padding?: undefined;
                    };
                    children: string[];
                } | {
                    component: string;
                    props: {
                        variant: string;
                        color: string;
                        padding?: undefined;
                    };
                    children: string[];
                } | {
                    component: string;
                    props: {
                        padding: string;
                        variant?: undefined;
                        color?: undefined;
                    };
                    children: {
                        component: string;
                        props: {
                            gap: string;
                        };
                        children: ({
                            component: string;
                            props: {
                                gap: string;
                                wrap: boolean;
                            };
                            children: ({
                                component: string;
                                children: ({
                                    component: string;
                                    children: string[];
                                    props?: undefined;
                                } | {
                                    component: string;
                                    props: {
                                        placeholder: string;
                                    };
                                    children?: undefined;
                                })[];
                            } | {
                                component: string;
                                children: ({
                                    component: string;
                                    children: string[];
                                    props?: undefined;
                                } | {
                                    component: string;
                                    props: {
                                        type: string;
                                        placeholder: string;
                                    };
                                    children?: undefined;
                                })[];
                            })[];
                        } | {
                            component: string;
                            children: ({
                                component: string;
                                children: string[];
                                props?: undefined;
                            } | {
                                component: string;
                                props: {
                                    options: {
                                        label: string;
                                        value: string;
                                    }[];
                                };
                                children?: undefined;
                            })[];
                            props?: undefined;
                        } | {
                            component: string;
                            children: ({
                                component: string;
                                children: string[];
                                props?: undefined;
                            } | {
                                component: string;
                                props: {
                                    placeholder: string;
                                    rows: number;
                                };
                                children?: undefined;
                            })[];
                            props?: undefined;
                        } | {
                            component: string;
                            children: ({
                                component: string;
                                props: {
                                    variant: string;
                                    onClick: {
                                        action: string;
                                        payload: {
                                            message: string;
                                            variant: string;
                                            title: string;
                                        };
                                    };
                                };
                                children: string[];
                            } | {
                                component: string;
                                props: {
                                    variant: string;
                                    onClick?: undefined;
                                };
                                children: string[];
                            })[];
                            props?: undefined;
                        })[];
                    }[];
                })[];
            }[];
        };
    };
    readonly pricingTable: {
        version: number;
        title: string;
        description: string;
        data: {
            tiers: {
                type: string;
                value: {
                    name: string;
                    price: string;
                    period: string;
                    description: string;
                    featured: boolean;
                    features: string[];
                }[];
            };
        };
        root: {
            component: string;
            props: {
                size: string;
            };
            children: {
                component: string;
                props: {
                    gap: string;
                };
                children: ({
                    component: string;
                    props: {
                        gap: string;
                        wrap?: undefined;
                        align?: undefined;
                    };
                    children: ({
                        component: string;
                        props: {
                            variant: string;
                            color?: undefined;
                        };
                        children: string[];
                    } | {
                        component: string;
                        props: {
                            variant: string;
                            color: string;
                        };
                        children: string[];
                    })[];
                } | {
                    component: string;
                    props: {
                        gap: string;
                        wrap: boolean;
                        align: string;
                    };
                    children: {
                        $each: string;
                        as: string;
                        node: {
                            component: string;
                            props: {
                                padding: string;
                            };
                            children: {
                                component: string;
                                props: {
                                    gap: string;
                                };
                                children: ({
                                    component: string;
                                    props: {
                                        gap: string;
                                        align: string;
                                        variant?: undefined;
                                        color?: undefined;
                                        onClick?: undefined;
                                    };
                                    children: ({
                                        component: string;
                                        props: {
                                            variant: string;
                                        };
                                        children: {
                                            $ref: string;
                                        }[];
                                        $cond?: undefined;
                                        then?: undefined;
                                    } | {
                                        $cond: string;
                                        then: {
                                            component: string;
                                            props: {
                                                variant: string;
                                                children: string;
                                            };
                                        };
                                        component?: undefined;
                                        props?: undefined;
                                        children?: undefined;
                                    })[];
                                } | {
                                    component: string;
                                    props: {
                                        gap: string;
                                        align: string;
                                        variant?: undefined;
                                        color?: undefined;
                                        onClick?: undefined;
                                    };
                                    children: ({
                                        component: string;
                                        props: {
                                            variant: string;
                                            color?: undefined;
                                        };
                                        children: {
                                            $ref: string;
                                        }[];
                                    } | {
                                        component: string;
                                        props: {
                                            variant: string;
                                            color: string;
                                        };
                                        children: {
                                            $ref: string;
                                        }[];
                                    })[];
                                } | {
                                    component: string;
                                    props: {
                                        variant: string;
                                        color: string;
                                        gap?: undefined;
                                        align?: undefined;
                                        onClick?: undefined;
                                    };
                                    children: {
                                        $ref: string;
                                    }[];
                                } | {
                                    component: string;
                                    props?: undefined;
                                    children?: undefined;
                                } | {
                                    component: string;
                                    props: {
                                        gap: string;
                                        align?: undefined;
                                        variant?: undefined;
                                        color?: undefined;
                                        onClick?: undefined;
                                    };
                                    children: {
                                        $each: string;
                                        as: string;
                                        node: {
                                            component: string;
                                            props: {
                                                variant: string;
                                            };
                                            children: {
                                                $ref: string;
                                            }[];
                                        };
                                    }[];
                                } | {
                                    component: string;
                                    props: {
                                        variant: string;
                                        onClick: {
                                            action: string;
                                            payload: {
                                                message: string;
                                                variant: string;
                                            };
                                        };
                                        gap?: undefined;
                                        align?: undefined;
                                        color?: undefined;
                                    };
                                    children: string[];
                                })[];
                            }[];
                        };
                    }[];
                })[];
            }[];
        };
    };
    readonly productLanding: {
        version: number;
        title: string;
        description: string;
        data: {
            features: {
                type: string;
                value: {
                    title: string;
                    description: string;
                }[];
            };
            showCta: {
                type: string;
                value: boolean;
            };
        };
        root: {
            component: string;
            props: {
                gap: string;
            };
            children: ({
                component: string;
                props: {
                    size: string;
                    overlay: boolean;
                    align: string;
                };
                children: ({
                    component: string;
                    props: {
                        src: string;
                        parallax: boolean;
                        animate?: undefined;
                        animation?: undefined;
                    };
                    children?: undefined;
                } | {
                    component: string;
                    props: {
                        animate: boolean;
                        animation: string;
                        src?: undefined;
                        parallax?: undefined;
                    };
                    children: {
                        component: string;
                        props: {
                            gap: string;
                        };
                        children: ({
                            component: string;
                            props: {
                                variant: string;
                                color: string;
                            };
                            children: string[];
                            $cond?: undefined;
                            then?: undefined;
                        } | {
                            $cond: string;
                            then: {
                                component: string;
                                props: {
                                    gap: string;
                                    justify: string;
                                };
                                children: ({
                                    component: string;
                                    props: {
                                        variant: string;
                                        size: string;
                                        onClick: {
                                            action: string;
                                            payload: {
                                                message: string;
                                                variant: string;
                                            };
                                        };
                                    };
                                    children: string[];
                                } | {
                                    component: string;
                                    props: {
                                        variant: string;
                                        size: string;
                                        onClick?: undefined;
                                    };
                                    children: string[];
                                })[];
                            };
                            component?: undefined;
                            props?: undefined;
                            children?: undefined;
                        })[];
                    }[];
                })[];
            } | {
                component: string;
                children: {
                    component: string;
                    props: {
                        gap: string;
                    };
                    children: ({
                        component: string;
                        props: {
                            variant: string;
                            columns?: undefined;
                            gap?: undefined;
                            animate?: undefined;
                        };
                        children: string[];
                    } | {
                        component: string;
                        props: {
                            columns: {
                                base: number;
                                md: number;
                            };
                            gap: string;
                            animate: boolean;
                            variant?: undefined;
                        };
                        children: {
                            $each: string;
                            as: string;
                            node: {
                                component: string;
                                children: {
                                    component: string;
                                    props: {
                                        padding: string;
                                    };
                                    children: {
                                        component: string;
                                        props: {
                                            gap: string;
                                        };
                                        children: ({
                                            component: string;
                                            props: {
                                                variant: string;
                                                color?: undefined;
                                            };
                                            children: {
                                                $ref: string;
                                            }[];
                                        } | {
                                            component: string;
                                            props: {
                                                variant: string;
                                                color: string;
                                            };
                                            children: {
                                                $ref: string;
                                            }[];
                                        })[];
                                    }[];
                                }[];
                            };
                        }[];
                    })[];
                }[];
                props?: undefined;
            })[];
        };
    };
    readonly teamDirectory: {
        version: number;
        title: string;
        description: string;
        data: {
            members: {
                type: string;
                value: {
                    name: string;
                    role: string;
                    department: string;
                    status: string;
                    avatar: string;
                }[];
            };
            teamSize: {
                type: string;
                value: string;
            };
            onlineCount: {
                type: string;
                value: string;
            };
        };
        root: {
            component: string;
            children: {
                component: string;
                props: {
                    gap: string;
                };
                children: ({
                    component: string;
                    props: {
                        variant: string;
                        gap?: undefined;
                        wrap?: undefined;
                    };
                    children: string[];
                } | {
                    component: string;
                    props: {
                        gap: string;
                        variant?: undefined;
                        wrap?: undefined;
                    };
                    children: {
                        component: string;
                        children: ({
                            component: string;
                            props: {
                                children: {
                                    $ref: string;
                                };
                            };
                        } | {
                            component: string;
                            props: {
                                children: string;
                            };
                        })[];
                    }[];
                } | {
                    component: string;
                    props: {
                        gap: string;
                        wrap: boolean;
                        variant?: undefined;
                    };
                    children: {
                        $each: string;
                        as: string;
                        node: {
                            component: string;
                            props: {
                                padding: string;
                            };
                            children: {
                                component: string;
                                props: {
                                    gap: string;
                                };
                                children: ({
                                    component: string;
                                    props: {
                                        gap: string;
                                        align: string;
                                        children?: undefined;
                                    };
                                    children: ({
                                        component: string;
                                        props: {
                                            src: {
                                                $ref: string;
                                            };
                                            name: {
                                                $ref: string;
                                            };
                                            size: string;
                                            status: {
                                                $ref: string;
                                            };
                                            gap?: undefined;
                                        };
                                        children?: undefined;
                                    } | {
                                        component: string;
                                        props: {
                                            gap: string;
                                            src?: undefined;
                                            name?: undefined;
                                            size?: undefined;
                                            status?: undefined;
                                        };
                                        children: ({
                                            component: string;
                                            props: {
                                                variant: string;
                                                weight: string;
                                                color?: undefined;
                                            };
                                            children: {
                                                $ref: string;
                                            }[];
                                        } | {
                                            component: string;
                                            props: {
                                                variant: string;
                                                color: string;
                                                weight?: undefined;
                                            };
                                            children: {
                                                $ref: string;
                                            }[];
                                        })[];
                                    })[];
                                } | {
                                    component: string;
                                    props: {
                                        children: {
                                            $ref: string;
                                        };
                                        gap?: undefined;
                                        align?: undefined;
                                    };
                                    children?: undefined;
                                })[];
                            }[];
                        };
                    }[];
                })[];
            }[];
        };
    };
};
export { analyticsDashboard, contactForm, pricingTable, productLanding, teamDirectory, };
//# sourceMappingURL=index.d.ts.map